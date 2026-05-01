# ImageForge 平台化开发计划

本文档衔接 `docs/对话01.md`（产品闭环与 MVP 边界）与 `docs/ImageForge_API_Document_Template.md`（枚举、模型与未来 REST 契约），并说明当前仓库内 **BFF（Node + Session Cookie）** 的落地位与阶段划分。

**更细的上线路线与运维清单见：`docs/IMAGEFORGE_LAUNCH_ROADMAP.md`。**

## 1. 目标与原则

- **产品形态**：限时「话题挑战 + 作品流」，非泛社区；作品强绑定本平台产出路径（历史记录可校验的 `/outputs` / `/uploads` 文件）。
- **合规**：公开展示默认 **AI 生成/编辑显式标识**（`aiLabel: true`）；后续可扩展隐式标识与审核队列。
- **体验**：Web 端延续现有 **玻璃/浅色** 体系（`forge.css` + `style.css` 变量）；**移动端**沿用 `viewport`、底部安全区、`forge-nav` 换行与触控目标尺寸。
- **认证**：当前阶段 **Cookie 会话**（`GET /api/auth/me`）；与模板中的 `Bearer accessToken` **语义对齐**，鸿蒙/独立客户端后续可接同一套资源路径，仅认证头不同。

## 2. API 契约映射（模板 ↔ 本仓库 BFF）

| 模板（ImageForge_API_Document_Template） | 当前 BFF 实现 | 说明 |
|------------------------------------------|---------------|------|
| `POST /auth/login` 等 | `/api/auth/*` | 已实现邮箱 OTP + 密码登录 |
| `GET /users/me` | `GET /api/auth/me` | 会话用户 |
| `GET /topics` | `GET /api/topics` | 已实现 |
| `GET /topics/{id}` | `GET /api/topics/:topicId` | 已实现；含 `settlementStatus` 等持久化字段 |
| `POST /topics/{id}/posts` | `POST /api/topics/:topicId/posts` | `historyProof` 绑定本机历史 |
| `GET /topics/{id}/posts` | `GET /api/topics/:topicId/posts` | 已实现 |
| `GET /posts/{id}` | `GET /api/posts/:postId` | 已实现 |
| `POST/DELETE /posts/{id}/like` | `/api/posts/.../like` | 已实现 |
| `POST/DELETE /posts/{id}/favorite` | `/api/posts/.../favorite` | Launch Pack |
| `POST/GET /posts/{id}/comments` | `/api/posts/.../comments` | 已实现 |
| `GET /topics/{id}/ranking` | `GET /api/topics/:topicId/ranking` | 简易互动分 |
| 积分流水 | `GET /api/auth/point-ledger` | 奖励入账 + 余额快照 |
| 举报 | `POST /api/posts/:id/report` | Launch Pack |
| 管理 | `GET /api/admin/moderation`、`GET /api/admin/summary`、`POST .../resolve`、`POST .../hide`、`POST .../topics/:id/settle` | `X-Admin-Key`；或 **管理员入口** 登录（`authPortal=admin` 且 `role: admin`） |
| 积分充值 / 完整账本 | 扩展 `PointLedger` 全类型 | Phase 2+ |
| 模板其余章节 | — | 按需迭代 |

响应格式：社区类接口 **`{ code, message, data }`**；认证接口 **`{ success, user, isAdmin?, authPortal? }`**（`authPortal` 为 `user` | `admin`）。

## 3. 数据存储路线

| 阶段 | 存储 | 用途 |
|------|------|------|
| Launch（遗留） | `community.json` 等 | 首次启动若 SQLite 为空则 **一次性导入** 后仍以 DB 为准 |
| **Phase 2（当前）** | `data/imageforge.sqlite`（`IMAGEFORGE_DB_PATH` / `IMAGEFORGE_DATA_DIR` 可覆盖） | 话题、作品、互动、结算、举报、积分流水 |
| 可选 | `moderation.json` / `point_ledger.json` | 仅作迁移源；运行期不写回 |

**运维**：定期备份 `data/imageforge.sqlite`；WAL 模式下可能产生 `-wal` / `-shm` 文件，一并备份或正常关停后复制单文件。存储实现为 **Node 内置 `node:sqlite`（`DatabaseSync`）**，要求 **Node.js ≥ 22.5**，不再依赖 `better-sqlite3` 原生扩展。

## 4. 分阶段交付

### Phase 1 — MVP + Launch Pack（本仓库当前）

- [x] 话题列表 / 详情（规则、时间窗、`allowedTaskTypes`、自动 `ended`）
- [x] 作品列表（最新 / 热度 / 排名）
- [x] 结果页 / 历史投稿（`historyProof` + 服务端文件校验）
- [x] 点赞、评论、收藏、简易排行榜
- [x] 作品 **AI 标识** 角标
- [x] 举报入口 + 管理端列表/结案 API + 下架作品 API
- [x] 话题 **结算发奖**（管理端幂等）+ **积分流水** + 设置页展示
- [x] 首页「话题挑战」入口

### Phase 2 — 数据与治理深化（本仓库已实现）

- [x] SQLite 单一库 + 空库时从 `community.json` / `point_ledger.json` / `moderation.json` 迁移
- [x] 排行综合分：点赞/评论权重可 per-topic 配置，**时间衰减**（半衰期默认 168h，字段 `scoreDecayHalfLifeHours`）
- [x] 创作扣费写入流水 `type: consume`（负 `amount`）
- [x] 环境变量 **`IMAGEFORGE_AUTO_SETTLE=1`**：每小时 + 启动约 15s 后对「已结束且未结算」话题执行与手动结算相同逻辑
- [x] 登录 **`intent: user | admin`**；管理 API 会话路径要求 **`authPortal === 'admin'`** 且管理员账号（`X-Admin-Key` 旁路不变）
- [x] 同源 **管理工作台** 页（导航仅管理员入口登录后可见）+ `GET /api/admin/summary`
- [ ] 充值 / 对账产品化、更强反作弊（后续）

### Phase 3 — 多端与商业化

- 鸿蒙 App、支付、品牌话题、对象存储

## 5. 前端信息架构（Web）

- 主导航 **「挑战」** + 首页卡片 **「话题挑战」** → 列表 → 详情（排序、榜、作品、举报/收藏）

## 6. 安全与校验（Launch）

- 投稿须登录；`historyProof.outRel` 防穿越；每用户每话题一篇；工作流白名单。
- 管理接口：`IMAGEFORGE_ADMIN_KEY`；或管理员账号在 **管理员入口** 登录（会话 `authPortal=admin`）。普通入口登录的管理员账号 **不会** 获得管理会话权限。

---

*版本：2026-04-30 — Phase 2（SQLite + 管理台 + 自动结算开关）已合入。*
