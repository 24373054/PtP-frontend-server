# 珠宝 / 电商商拍垂直能力 — 全量实施计划

> 分支：`feature/jewelry-commerce`  
> 基线：现有 ImageForge Web（Flux2 img2img 编辑管线 + `workflowTemplate` 参数分叉 + `presets.json`）

本文档描述**非 MVP**的完整范围：四条主链路、多品类提示策略、场景包、导出预设、可选水印、客户端批量队列，以及与 ComfyUI 节点参数的真实差异（非仅改提示词）。

---

## 1. 目标用户与场景

- 珠宝电商主图 / 详情（戒指、项链、耳饰、手镯、文玩玉石、轻奢腕表等）
- 门店 / 微商快速出图：白底图、轻奢场景、微距细节强化
- 小工作室：统一主图尺寸、平台规范导出

---

## 2. 信息架构

| 层级 | 内容 |
|------|------|
| 首页 | 保留通用「风格化 / 高清 / 背景」卡片；**新增**四条珠宝卡片（精修 / 抠图白底 / 场景 / 微距高清） |
| 创作页 | 编辑模式下：**珠宝商拍**折叠面板（品类、场景快捷句、导出尺寸、白边留白、水印）；**批量队列**（多图顺序跑同一参数） |
| 历史 | 记录 `workflowTemplate`、`postProcess` 摘要；从详情「在创作中打开」可还原珠宝模式 |

---

## 3. 后端契约

### 3.1 编辑 API（已有，扩展字段）

- `POST /api/edit`、`POST /api/edit-stream`  
- **已有**：`image`、`prompt`、`accessCode`、`workflowTemplate`  
- **新增**：`postProcess`（字符串化 JSON，可选）

`postProcess`  schema：

```json
{
  "paddingRatio": 0.08,
  "export": { "width": 800, "height": 800 },
  "watermark": { "text": "SHOP", "opacity": 0.35 }
}
```

- `paddingRatio`：0–0.3，在图像四周加**纯白**边（相对最长边的比例），便于主图留白。
- `export`：`sharp` `contain` 放入目标矩形，不足部分白底（常见电商平台主图）。
- `watermark`：右下角文字（SVG 合成），`opacity` 0.05–1。

处理顺序：Comfy 出图写入 PNG → **后处理覆盖原文件** → 再生成缩略图。

### 3.2 工作流模板 ID（`normalizeEditTemplate`）

| `workflowTemplate` | 语义 | Comfy 侧策略（与通用模板的差异） |
|--------------------|------|-----------------------------------|
| `jewelry_retouch` | 金属高光 / 宝石火彩精修 | 略高于风格化的 steps，中等 megapixels，lanczos |
| `jewelry_product_cutout` | 抠图 / 白底 / 干净边缘 | 高 CFG + 较高 steps（对齐「背景重绘」类但更强约束） |
| `jewelry_scene` | 场景合成 / 轻奢布景 | 中高 megapixels + 中高 steps + 略提 CFG |
| `jewelry_macro_detail` | 微距细节 / 商用放大 | 对齐高清增强并略增 steps |

节点 ID 与通用编辑一致（`75:80` 缩放、`75:62` steps、`75:63` cfg、`9` filename_prefix），可由 `workflows/edit_variants.json` 覆盖。

### 3.3 静态配置

- `GET /api/presets`：在 `workflows/presets.json` 中增加 `jewelryWorkflows`、`jewelryScenePacks`、`jewelryProductCategories`、`exportPresets`、`editPresets` 珠宝条目。

---

## 4. 前端行为

### 4.1 `editIntentTask` 扩展

- 原有：`style` | `upscale` | `background`
- 新增：`jewelry_retouch` | `jewelry_cutout` | `jewelry_scene` | `jewelry_macro`

映射到 `workflowTemplate` 与横幅文案；**横幅**区分珠宝子模式。

### 4.2 品类与场景

- 品类下拉：从 `jewelryProductCategories` 读取；切换时在提示词前**拼接**简短英文/中文构图提示（不改变 Comfy 图结构）。
- 场景芯片：从 `jewelryScenePacks` 读取，点击追加到提示词。

### 4.3 预设芯片

- `editPresets` 增加 `jewelry_*` 键；`renderEditPresetChips` 在珠宝相关任务下优先展示珠宝芯片（或始终展示第二行珠宝芯片——实现为扩展 keys 列表）。

### 4.4 批量队列

- 多文件选择 → 列表展示 → 「开始批量」：对每张图**顺序**调用 `/api/edit-stream`（与单图相同表单字段），避免并发压垮 Comfy。每张完成后写入历史。

### 4.5 历史回放

- `workflowTemplate` 反查扩展为珠宝四类；`postProcess` 若存在则写入 `params` 便于审计。

---

## 5. 测试与验收

- [ ] 四种 `workflowTemplate` 均被 `GET /api/edit-variants` 列出且 `normalizeEditTemplate` 不回落到默认 `img2img_style`
- [ ] 带 `postProcess` 的编辑：输出尺寸与水印肉眼可见正确；缩略图与下载一致
- [ ] 首页珠宝卡片进入创作后横幅与 `workflowTemplate` 一致
- [ ] 批量队列 3 张图顺序完成且积分扣减正确
- [ ] 无 GPU 时行为与原有一致（错误提示）

---

## 6. 后续可选（不在本分支硬性范围）

- 服务端真·批量 API（一次 multipart 多图）
- 与队列实验技能（`experiment-queue`）对接远程 GPU
- 独立「仅后处理」API（对已上传 PNG 只做 sharp）

---

## 7. 文件清单（本分支改动）

| 路径 | 说明 |
|------|------|
| `docs/JEWELRY_COMMERCE_PLAN.md` | 本计划 |
| `server.js` | 珠宝模板别名/patch、`applyOutputPostProcess`、edit/edit-stream 接入 |
| `workflows/presets.json` | 珠宝元数据与导出预设 |
| `public/index.html` | 首页卡片、编辑区珠宝面板与批量 UI |
| `public/script.js` | 任务映射、FormData、批量、i18n、历史 |
| `public/forge.css` | 珠宝面板与批量列表样式 |
