# ImageForge 上线路线图（对照整体设计蓝图）

本文档在 `docs/对话01.md`（产品闭环）、`docs/ImageForge_API_Document_Template.md`（契约）、`docs/IMAGEFORGE_PLATFORM_DEV_PLAN.md`（阶段）之上，给出**可执行**的继续开发与上线切片；并标明**本仓库已落地**与**上线后迭代**边界。

---

## 一、蓝图分层（目标态）

| 层级 | 内容 | 目标 |
|------|------|------|
| L1 工具与 BFF | 编辑/生成、会话、积分消耗 | 已具备，持续修 bug |
| L2 挑战与作品流 | 话题、投稿、互动、排行、AI 标识 | Phase 1 核心 |
| L3 激励与账本 | 活动结算、奖励入账、流水可查 | 本版本补齐 |
| L4 治理 | 举报、审核、下架、审计 | 本版本 MVP |
| L5 合规与资质 | 标识办法、备案/许可咨询 | 法务/运维，非纯代码 |
| L6 多端与商业化 | 鸿蒙、支付、品牌话题 | 独立项目 |

---

## 二、本仓库「上线包」范围（Launch Pack）

以下视为**同一次上线**应交付的最小集合（BFF + Web）：

1. **挑战与社区（L2）**  
   话题列表/详情、作品流、投稿校验、点赞/评论/收藏、简易排行、显式 AI 角标。

2. **话题生命周期**  
   到达 `endAt` 后话题自动变为 `ended`，榜单冻结语义与文档一致。

3. **活动结算（L3）**  
   管理员触发 **幂等** 结算：按 `rewardRules` 与最终排名发放 **credits**（与现有创作积分同一余额），并写入 **积分流水**。

4. **积分流水（L3）**  
   用户可在设置页查看本人 `reward` / `consume`（若接入）记录摘要。

5. **治理 MVP（L4）**  
   用户举报作品；管理员列出/结案举报；管理员下架作品（隐藏）。

6. **运维**  
   `IMAGEFORGE_ADMIN_KEY` 环境变量保护管理接口；`moderation.json` / `point_ledger.json` / `community.json` 不入库。

---

## 三、上线后迭代（不在本 Launch Pack 承诺内）

- 模板全文：JWT、`/files/images`、完整任务表、收藏/分享全量、反作弊模型、自动定时结算（cron）、SQLite/PostgreSQL 迁移、鸿蒙 App、支付与发票、ICP/经营许可流程。

---

## 四、运维清单（上线当日）

1. 设置环境变量：`SESSION_SECRET`、`IMAGEFORGE_ADMIN_KEY`（强随机）。  
2. 生产环境建议：`SESSION_COOKIE_SECURE=1`（HTTPS）。  
3. 活动结束 → 话题状态会随时间自动变为 `ended`；随后由运维执行结算（**幂等**，已结算返回 `40010`）：  
   `curl -sS -X POST -H "X-Admin-Key: $IMAGEFORGE_ADMIN_KEY" "https://你的域名/api/admin/topics/topic_open_v1/settle"`  
4. 查看举报队列：  
   `curl -sS -H "X-Admin-Key: $IMAGEFORGE_ADMIN_KEY" "https://你的域名/api/admin/moderation?status=open"`  
5. 定期备份：`community.json`、`moderation.json`、`point_ledger.json`、`accounts.json`。  
6. 可选：在 `accounts.json` 为运营账号增加 `"role": "admin"`，即可不用 Header、仅用浏览器会话调用管理接口（仍建议生产以 Key 为主）。

---

## 五、与 API 模板的路径对照（Launch）

| 能力 | BFF 路径 |
|------|----------|
| 举报 | `POST /api/posts/:postId/report` |
| 收藏 | `POST/DELETE /api/posts/:postId/favorite` |
| 流水 | `GET /api/auth/point-ledger` |
| 结算 | `POST /api/admin/topics/:topicId/settle` |
| 举报队列 | `GET /api/admin/moderation`、`POST /api/admin/moderation/:id/resolve` |
| 下架 | `POST /api/admin/posts/:postId/hide` |

---

*文档版本：2026-04-30 — 与 Launch Pack 代码同步。*
