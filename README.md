# ImageForge Web (PtP-frontend-server)

基于 **ComfyUI** 的图像编辑 / 生成 Web 端（Vanilla JS + Node/Express BFF）。  
浏览器只请求本服务；本服务在服务端转发到 ComfyUI，并返回结果与 SSE 进度。  
账号、话题挑战、作品、举报与积分流水等持久化在本地 **SQLite**（`node:sqlite`），详见下文「数据存储」。

## 功能

- **编辑图片（I2I）**：上传图片 + 自然语言指令
- **生成图片（T2I）**：提示词 + 尺寸 / steps / CFG（支持 SSE）
- **编辑模板**（服务端真实差异，不是「演示提示词」）
  - `img2img_style`：风格化修图（较低步数/像素，速度快）
  - `image_upscale`：高清增强（lanczos 放大 + 更高 megapixels/steps，更耗时/显存）
  - `background_repaint`：背景重绘（提高 CFG + 中等 steps，建议配合背景类提示词）
  - **珠宝 / 商品**：`jewelry_retouch`、`jewelry_product_cutout`、`jewelry_scene`、`jewelry_macro_detail`（见 `workflows/presets.json`）
- **账号与积分**：邮箱注册 / 登录（密码或验证码）、订阅方案与积分扣减；设置页可查看个人积分流水
- **话题挑战（社区）**：限时话题、发布本平台产出作品、点赞 / 评论 / 排行、结算后奖励积分（作品需绑定可校验的产出路径）
- **举报与合规**：公开作品 AI 标识；用户举报；**管理员入口**下可查看举报、全站流水、话题与作品全文（含隐藏帖）
- **历史记录**：浏览器本地保存成功任务摘要，可离线回看；参与话题提交时依赖服务端仍在的 `/outputs` 或 `/uploads` 文件
- **设置面板**：健康检查 / 版本信息
- **页脚备案与法律页**：服务条款 / 隐私政策 / 公安备案跳转

## 运行环境

- **Node.js ≥ 22.5**（`package.json` 的 `engines`；内置 `node:sqlite` / `DatabaseSync`）
- ComfyUI（默认 `http://127.0.0.1:8188`，可在 `server.js` 顶部 `COMFYUI_INSTANCES` 调整）
- `npm install` 安装依赖

## 快速开始（本机）

1) 安装依赖

```bash
cd PtP-frontend-server
npm install
```

2) 启动 ComfyUI（示例）

```bash
cd ../ComfyUI && ./comfyui-daemon.sh start
```

3) 启动 Web 服务

```bash
npm start
```

4) 访问

- **本机**：`http://localhost:38024`
- **局域网**：以 `server.js` 启动日志里输出的 Network 地址为准

## 公网访问（FRP）

仓库附带了启动脚本，会按顺序检查 ComfyUI → 启 PtP → 启 frpc。

```bash
bash start_with_frp.sh
```

FRP 配置模板按你本机路径维护；注意 token 等敏感信息勿提交进仓库。

## 关键配置（环境变量）

默认 ComfyUI 与模型名在 `server.js` 里可通过环境变量覆盖（避免不同机器模型文件名不一致导致 400）。

- **模型名**
  - `COMFYUI_UNET_NAME`
  - `COMFYUI_CLIP_NAME`
  - `COMFYUI_VAE_NAME`
- **会话（生产务必修改）**
  - `SESSION_SECRET`：Cookie 会话密钥（默认仅为开发占位）
  - `SESSION_COOKIE_SECURE`：设为 `1` 时 Cookie 仅 HTTPS 传输
- **管理员 API（可选）**
  - `IMAGEFORGE_ADMIN_KEY`：请求头 `X-Admin-Key` 与管理员能力探测一致；亦可使用在 `accounts.json` 中 `role: "admin"` 的账号通过「管理员入口」登录
- **数据目录与库路径（可选）**
  - `IMAGEFORGE_DATA_DIR`：数据根目录（默认仓库下 `data/`）
  - `IMAGEFORGE_DB_PATH`：SQLite 文件路径（默认 `$IMAGEFORGE_DATA_DIR/imageforge.sqlite`）
- **自动结算（可选）**
  - `IMAGEFORGE_AUTO_SETTLE`：设为 `1` 或 `true` 时服务端按策略对已结束话题执行结算（详见 `server.js` 日志）

示例：

```bash
export COMFYUI_UNET_NAME="xxx.safetensors"
export COMFYUI_CLIP_NAME="split_files/text_encoders/xxx.safetensors"
export COMFYUI_VAE_NAME="xxx.safetensors"
export SESSION_SECRET="your-long-random-string"
npm start
```

## 认证说明（编辑 / 生成 SSE）

`POST /api/edit-stream` 与 `POST /api/generate-stream` 需要 **已登录会话**（`credentials: 'include'` 的 Cookie）或兼容路径下的 **`accessCode`**（`users.json` 旧版邀请码用户，见请求 body / query）。未认证返回 401；积分不足返回 402。

## 数据存储与备份

| 数据 | 位置 |
|------|------|
| 话题、作品、评论、举报、积分流水等 | `data/imageforge.sqlite`（及 WAL 模式下可能存在的 `-wal` / `-shm`） |
| 注册账号（含密码哈希，勿泄露） | `accounts.json`（默认已 `.gitignore`） |
| 首次若 DB 为空，可从遗留 JSON 一次性导入 | `community.json` 等（运行期以 DB 为准；详见 `docs/IMAGEFORGE_PLATFORM_DEV_PLAN.md`） |

**运维建议**：定期备份 SQLite；备份 WAL 模式时尽量在业务量低时拷贝，或正常停服后复制完整文件集。

更完整的 API 枚举与演进契约见：**`docs/ImageForge_API_Document_Template.md`**；平台阶段与上线清单见 **`docs/IMAGEFORGE_PLATFORM_DEV_PLAN.md`**、**`docs/IMAGEFORGE_LAUNCH_ROADMAP.md`**。

## 工作流模板与预设

模板与预设在 `workflows/` 下维护：

- `workflows/presets.json`：模板清单（`workflowTemplate`）+ 编辑提示词预设（含珠宝类）
- `workflows/img2img_style.json` / `image_upscale.json` / `background_repaint.json`：模板说明与合并参考
- `workflows/edit_variants.json`：可选覆盖（为空则使用内置 patch）

前端提交编辑请求时可指定：

- `workflowTemplate`：上述任一已支持模板 id（与 `presets.json` 对齐）

## 目录结构

```
PtP-frontend-server/
├── server.js
├── package.json
├── start.sh
├── start_with_frp.sh
├── ptp-daemon.sh
├── lib/                    # accounts、SQLite 社区/流水/举报等
├── data/                   # imageforge.sqlite（默认 gitignore）
├── docs/                   # 平台计划、API 模板等
├── tools/
├── public/
│   ├── index.html
│   ├── style.css
│   ├── forge.css
│   ├── phosphor-bold.css
│   ├── script.js
│   ├── terms.html
│   ├── privacy.html
│   └── assets/
├── workflows/
│   ├── presets.json
│   ├── img2img_style.json
│   ├── image_upscale.json
│   ├── background_repaint.json
│   └── edit_variants.json
├── uploads/
└── outputs/
```

## API 摘要

社区类接口响应形如 **`{ code, message, data }`**；认证相关接口多为 **`{ success, user, ... }`**。完整路径、字段与错误码以 **`docs/ImageForge_API_Document_Template.md`** 为准。

### POST /api/edit

Edit an image with a text prompt.

Request:

- `image`: Image file (multipart/form-data)
- `prompt`: Edit instructions (text)
- `negativePrompt` (optional): Exclusion hint (text)
- `workflowTemplate` (optional): 见上文预设 id

Response:

```json
{
  "success": true,
  "image": "/outputs/xxx.png",
  "prompt": "..."
}
```

### POST /api/edit-stream (SSE)

编辑图片并推送进度；需登录会话或 `accessCode`。请求为 `multipart/form-data`（`image` + `prompt` 等），响应为 Server-Sent Events。

Event format 示例：

```
data: {"status": "initializing", "progress": 5, "message": "Uploading image..."}
data: {"status": "completed", "progress": 100, "result": {...}}
```

### GET /api/health

检查本服务与 ComfyUI 连通性。

### GET /api/version

服务版本、ComfyUI 地址、能力位（如 `authEmailOtp`、`communityTopics`、`storageSqlite` 等）。设置页会读取。

### GET /api/presets

返回 `workflows/presets.json` 原文。

### GET /api/edit-variants

返回服务端内置 patch、别名与可选文件覆盖。

### POST /api/generate-stream

文生图 SSE。请求体为 JSON（`prompt`、`width` / `height`、`steps`、`cfg`、`gridMode` 等）；需登录或 `accessCode`。

（非 SSE 的 `POST /api/generate` 与 `POST /api/generate-grid` 仍保留，用于兼容或调试。）

### 社区与管理（节选）

- `GET /api/topics`、`GET /api/topics/:id`、`POST /api/topics/:id/posts` …
- `GET /api/auth/point-ledger`：当前登录用户积分流水
- `POST /api/posts/:id/report`：举报
- `GET /api/admin/*`：摘要、举报列表、结算、话题/作品全文、全站流水等（**需管理员**；`X-Admin-Key` 或管理员会话）

## 法律与备案（页脚）

页脚与法律页默认已填入：

- 主办单位：北京刻熵科技有限责任公司
- 联系邮箱：24373054@buaa.edu.cn
- 联系地址：北京市海淀区北四环中路238号柏彦大厦F12
- 公安备案：京公网安备11010802046852号（跳转查询页）

如需增加/替换 ICP 备案号，请修改：

- `public/script.js` 中的 `footer.icp`（中英文）
- 或直接改 `public/index.html` 页脚静态文案
