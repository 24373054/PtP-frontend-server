#!/bin/bash
# 启动 P2P 服务和 frpc

echo "=== P2P Image Editor + FRP 启动脚本 ==="
echo ""

# 检查 ComfyUI
echo "[1/3] 检查 ComfyUI..."
if curl -s http://127.0.0.1:8188/system_stats > /dev/null 2>&1; then
    echo "✓ ComfyUI 正在运行"
else
    echo "✗ ComfyUI 未运行"
    echo ""
    echo "请先启动 ComfyUI:"
    echo "  bash /home/Matrix/yz/AI-movie/ai-comic-drama/start_comfyui.sh"
    echo ""
    exit 1
fi

# 启动 frpc
echo ""
echo "[2/3] 启动 frpc..."
FRP_DIR="/home/Matrix/yz/frp/frp_0.66.0_linux_amd64"

# 检查是否已经运行
if pgrep -f "frpc -c" > /dev/null; then
    echo "✓ frpc 已在运行"
else
    cd $FRP_DIR
    nohup ./frpc -c frpc.toml > frpc.log 2>&1 &
    sleep 2
    
    if pgrep -f "frpc -c" > /dev/null; then
        echo "✓ frpc 启动成功"
    else
        echo "✗ frpc 启动失败，查看日志: $FRP_DIR/frpc.log"
        exit 1
    fi
fi

# 启动 P2P 服务
echo ""
echo "[3/3] 启动 P2P 服务..."
cd /home/Matrix/yz/AI-movie/p2p-server

# 检查是否已经运行
if pgrep -f "node server.js" > /dev/null; then
    echo "✗ P2P 服务已在运行，请先停止"
    echo "  pkill -f 'node server.js'"
    exit 1
fi

node server.js
