#!/usr/bin/env bash
# PtP 前端服务后台启动 / 停止 / 状态（默认端口 38024；默认 conda 环境 yz）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

PIDFILE="${PTP_PIDFILE:-$ROOT/.ptp.pid}"
LOGFILE="${PTP_LOG:-$ROOT/ptp-daemon.log}"
PORT="${PTP_PORT:-38024}"
LISTEN_URL="${PTP_LISTEN_URL:-http://127.0.0.1:${PORT}}"
# PTP_CONDA_ENV：未设置时默认 yz；显式设为空则不用 conda（使用 PATH 中的 node）
CONDA_ENV_EFFECTIVE="${PTP_CONDA_ENV-yz}"

is_running() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

# 释放本机 PORT 上的 TCP 监听（解决：旧 node 仍占 38024 → 新进程 EADDRINUSE → 浏览器仍打到旧版、/api/auth 返回 HTML）
free_port_tcp() {
  local port="$1"
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
    sleep 0.6
    return 0
  fi
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti TCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${pids}" ]]; then
      # shellcheck disable=SC2086
      kill -TERM ${pids} 2>/dev/null || true
      sleep 1
      pids="$(lsof -ti TCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
      if [[ -n "${pids}" ]]; then
        # shellcheck disable=SC2086
        kill -KILL ${pids} 2>/dev/null || true
      fi
    fi
    sleep 0.3
    return 0
  fi
  echo "提示: 未找到 fuser/lsof，若重启后仍 EADDRINUSE，请手动结束占用 ${port} 的进程。" >&2
}

# 解析 conda 安装根目录（用于 source conda.sh；比 conda run 更易与「手动 activate yz」行为一致）
ptp_conda_base() {
  if [[ -n "${CONDA_EXE:-}" ]]; then
    local d
    d="$(dirname "$CONDA_EXE")"
    if [[ -f "$d/../etc/profile.d/conda.sh" ]]; then
      (cd "$d/.." && pwd)
      return 0
    fi
  fi
  if command -v conda >/dev/null 2>&1; then
    conda info --base 2>/dev/null
    return 0
  fi
  return 1
}

# conda activate 后必须用前缀里的二进制，否则 PATH 里可能仍是系统 node（导致检测用 v20、启动用 v25）
ptp_require_conda_prefix_bin() {
  if [[ -z "${CONDA_PREFIX:-}" || ! -x "${CONDA_PREFIX}/bin/node" ]]; then
    echo "错误: conda activate「${CONDA_ENV_EFFECTIVE}」后 CONDA_PREFIX 无效或缺少 bin/node（CONDA_PREFIX=${CONDA_PREFIX:-未设置}）。" >&2
    echo "请在该环境中执行: conda install -c conda-forge nodejs 或调整 PTP_CONDA_ENV。" >&2
    return 1
  fi
  return 0
}

# 社区数据层使用 Node 内置 node:sqlite（需 Node >= 22.5），无 better-sqlite3 原生 ABI 问题。
ensure_node_sqlite_runtime() {
  [[ "${PTP_SKIP_NATIVE_CHECK:-}" == 1 ]] && return 0
  if [[ -n "${PTP_NODE:-}" ]]; then
    if ! "$PTP_NODE" -e "require('node:sqlite')" 2>/dev/null; then
      echo "错误: ImageForge 需要 Node.js >= 22.5（内置 node:sqlite）。" >&2
      "$PTP_NODE" -e "console.error('当前 Node:', process.version)" >&2
      exit 1
    fi
  elif [[ -n "$CONDA_ENV_EFFECTIVE" ]]; then
    local cbase
    cbase="$(ptp_conda_base)" || {
      echo "错误: 无法解析 conda 安装路径（conda info --base）。" >&2
      exit 1
    }
    if ! (
      set +u
      # shellcheck source=/dev/null
      source "$cbase/etc/profile.d/conda.sh"
      conda activate "$CONDA_ENV_EFFECTIVE" || exit 1
      set -e
      ptp_require_conda_prefix_bin || exit 1
      "$CONDA_PREFIX/bin/node" -e "require('node:sqlite')"
    ); then
      echo "错误: 当前 conda 环境的 Node 过旧，不支持内置 node:sqlite（需 >= 22.5）。" >&2
      echo "可尝试: conda install -c conda-forge \"nodejs>=22\"" >&2
      exit 1
    fi
  else
    if ! (cd "$ROOT" && node -e "require('node:sqlite')" 2>/dev/null); then
      echo "错误: ImageForge 需要 Node.js >= 22.5（内置 node:sqlite）。当前:" >&2
      node -e "console.error(process.version)" >&2
      exit 1
    fi
  fi
}

cmd_start() {
  if [[ -f "$PIDFILE" ]]; then
    local old
    old="$(cat "$PIDFILE" 2>/dev/null || true)"
    if is_running "$old"; then
      echo "PtP 服务已在运行 (PID $old)，访问 ${LISTEN_URL}"
      exit 0
    fi
    rm -f "$PIDFILE"
  fi

  touch "$LOGFILE"
  ensure_node_sqlite_runtime
  # nohup 写入的 PID 有时是 conda 包装进程，与真正 listen 的 node 不一致；启动前清端口避免旧实例占坑
  free_port_tcp "$PORT"

  if [[ -n "${PTP_NODE:-}" ]]; then
    nohup "$PTP_NODE" "$ROOT/server.js" >>"$LOGFILE" 2>&1 &
  elif [[ -n "$CONDA_ENV_EFFECTIVE" ]]; then
    if ! command -v conda >/dev/null 2>&1; then
      echo "错误: 默认使用 conda 环境「${CONDA_ENV_EFFECTIVE}」，但未在 PATH 中找到 conda。" >&2
      echo "请先初始化 conda，或设置 PTP_NODE 为 node 可执行文件，或 PTP_CONDA_ENV= 使用 PATH 中的 node。" >&2
      exit 1
    fi
    local cbase
    cbase="$(ptp_conda_base)" || {
      echo "错误: 无法解析 conda 安装路径。" >&2
      exit 1
    }
    # 与「conda activate yz && node server.js」同链路的 PATH/node，避免 conda run 下 npm 与 node 不一致
    nohup env PTP_CONDA_BASE="$cbase" PTP_CONDA_ENV_NAME="$CONDA_ENV_EFFECTIVE" PTP_SERVER_ROOT="$ROOT" bash -c '
      set -e
      set +u
      source "$PTP_CONDA_BASE/etc/profile.d/conda.sh"
      conda activate "$PTP_CONDA_ENV_NAME" || exit 1
      if [[ -z "${CONDA_PREFIX:-}" || ! -x "${CONDA_PREFIX}/bin/node" ]]; then
        echo "ptp-daemon: conda activate 后无 CONDA_PREFIX/bin/node" >&2
        exit 1
      fi
      cd "$PTP_SERVER_ROOT"
      exec "$CONDA_PREFIX/bin/node" "$PTP_SERVER_ROOT/server.js"
    ' >>"$LOGFILE" 2>&1 &
  else
    nohup node "$ROOT/server.js" >>"$LOGFILE" 2>&1 &
  fi
  echo $! >"$PIDFILE"
  echo "已后台启动 PtP 服务，PID $(cat "$PIDFILE")"
  if [[ -n "${PTP_NODE:-}" ]]; then
    echo "Node: $PTP_NODE"
  elif [[ -n "$CONDA_ENV_EFFECTIVE" ]]; then
    echo "Conda 环境: $CONDA_ENV_EFFECTIVE (source conda.sh + conda activate)"
  else
    echo "Node: PATH 中的 node"
  fi
  echo "日志: $LOGFILE"
  echo "地址: ${LISTEN_URL}"
}

cmd_stop() {
  if [[ ! -f "$PIDFILE" ]]; then
    echo "未找到 PID 文件 ($PIDFILE)，可能未通过本脚本启动。"
    exit 1
  fi
  local pid
  pid="$(cat "$PIDFILE" 2>/dev/null || true)"
  if ! is_running "$pid"; then
    echo "PID $pid 未在运行，清理 PID 文件。"
    rm -f "$PIDFILE"
    exit 0
  fi

  echo "正在停止 PtP 服务 (PID $pid)..."
  kill -TERM "$pid" 2>/dev/null || true
  local i=0
  while is_running "$pid" && [[ $i -lt 30 ]]; do
    sleep 1
    i=$((i + 1))
  done
  if is_running "$pid"; then
    echo "优雅退出超时，发送 SIGKILL。"
    kill -KILL "$pid" 2>/dev/null || true
  fi
  rm -f "$PIDFILE"
  free_port_tcp "$PORT"
  echo "已停止。"
}

cmd_status() {
  if [[ ! -f "$PIDFILE" ]]; then
    echo "状态: 未运行（无 PID 文件）"
    exit 1
  fi
  local pid
  pid="$(cat "$PIDFILE" 2>/dev/null || true)"
  if is_running "$pid"; then
    echo "状态: 运行中 (PID $pid)"
    echo "地址: ${LISTEN_URL}"
    echo "日志: $LOGFILE"
    if command -v curl >/dev/null 2>&1; then
      if out="$(curl -s -m 2 "${LISTEN_URL}/api/health" 2>/dev/null)" && [[ -n "$out" ]]; then
        echo "健康检查: $out"
      fi
    fi
    exit 0
  fi
  echo "状态: 未运行（PID 文件陈旧，PID $pid 不存在）"
  exit 1
}

cmd_restart() {
  if [[ -f "$PIDFILE" ]]; then
    local pid
    pid="$(cat "$PIDFILE" 2>/dev/null || true)"
    if is_running "$pid"; then
      cmd_stop
    else
      rm -f "$PIDFILE"
    fi
  fi
  cmd_start
}

usage() {
  echo "用法: $0 {start|stop|status|restart}"
  echo ""
  echo "环境变量（可选）:"
  echo "  PTP_PORT         仅用于提示里的 URL，须与 server.js 中 PORT 一致（默认 38024）"
  echo "  PTP_LISTEN_URL   状态/启动提示中的完整地址，默认 http://127.0.0.1:\$PTP_PORT"
  echo "  PTP_CONDA_ENV    未设置时默认 yz（启动前 source conda.sh 并 conda activate）；设为空字符串则不用 conda"
  echo "  PTP_NODE         若设置则优先使用该可执行文件启动 server.js，忽略 conda"
  echo "  PTP_LOG          日志路径，默认 \$ROOT/ptp-daemon.log"
  echo "  PTP_PIDFILE      PID 路径，默认 \$ROOT/.ptp.pid"
  echo "  PTP_SKIP_NATIVE_CHECK=1  跳过 Node node:sqlite 版本检测（不推荐）"
  echo ""
  echo "说明: start/stop 时会尝试释放 \$PTP_PORT 上的监听进程，避免旧 node 占坑导致新代码无法加载。"
  echo "      社区 SQLite 使用 Node 内置 node:sqlite；请保证 Node >= 22.5（与 package.json engines 一致）。"
}

case "${1:-}" in
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  status)  cmd_status ;;
  restart) cmd_restart ;;
  *)       usage; exit 1 ;;
esac
