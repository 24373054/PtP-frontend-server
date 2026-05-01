# ImageForge API 文档模板

> 适用范围：ImageForge Web / 鸿蒙 App / 后端服务  
> 目标：前端按本文档对接；后端按本文档实现；字段未定处用 `TODO` 填充。

---

## 0. 文档信息

| 项 | 内容 |
|---|---|
| 项目 | ImageForge |
| API 版本 | `v1` |
| 文档版本 | `TODO: 0.1.0` |
| 后端负责人 | `TODO` |
| 前端负责人 | `TODO` |
| 最后更新 | `TODO: YYYY-MM-DD` |
| Base URL - Dev | `TODO: https://dev.example.com/api/v1` |
| Base URL - Prod | `TODO: https://example.com/api/v1` |

---

## 1. 全局约定

### 1.1 请求格式

| 项 | 约定 |
|---|---|
| 协议 | HTTPS |
| 数据格式 | JSON |
| 字符编码 | UTF-8 |
| 时间格式 | ISO 8601：`2026-05-01T10:30:00+08:00` |
| 文件上传 | `multipart/form-data` |
| 鉴权方式 | `Authorization: Bearer <accessToken>` |
| 幂等请求头 | `Idempotency-Key: <uuid>`，用于支付、扣积分、提交任务 |

### 1.2 通用请求头

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
X-Client-Type: web | harmony
X-Client-Version: 1.0.0
Idempotency-Key: <uuid>
```

### 1.3 通用响应结构

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "requestId": "req_xxx",
  "timestamp": "2026-05-01T10:30:00+08:00"
}
```

### 1.4 分页响应结构

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [],
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "hasMore": true
  },
  "requestId": "req_xxx"
}
```

### 1.5 通用错误码

| code | HTTP | 含义 | 前端处理 |
|---:|---:|---|---|
| 0 | 200 | 成功 | 正常渲染 |
| 40000 | 400 | 参数错误 | 展示字段错误 |
| 40100 | 401 | 未登录 / Token 失效 | 跳转登录 |
| 40300 | 403 | 无权限 | 提示无权限 |
| 40400 | 404 | 资源不存在 | 提示不存在 |
| 40900 | 409 | 状态冲突 / 重复提交 | 提示重试或刷新 |
| 42900 | 429 | 请求过快 | 提示稍后再试 |
| 50000 | 500 | 服务异常 | 提示服务异常 |
| 50100 | 500 | AI 后端异常 | 提示生成失败 |
| 50200 | 502 | ComfyUI 不可达 | 提示服务繁忙 |
| 60001 | 400 | 积分不足 | 引导充值 |
| 60002 | 400 | 内容审核不通过 | 展示审核原因 |
| 60003 | 400 | 话题已结束 | 禁止投稿 |

---

## 2. 枚举定义

### 2.1 用户角色 `userRole`

| 值 | 含义 |
|---|---|
| `user` | 普通用户 |
| `creator` | 创作者 |
| `admin` | 管理员 |

### 2.2 任务类型 `taskType`

| 值 | 含义 |
|---|---|
| `style_edit` | 风格化修图 |
| `upscale` | 高清增强 |
| `background_repaint` | 背景重绘 |
| `jewelry_retouch` | 珠宝精修 |
| `jewelry_product_cutout` | 抠图白底 |
| `jewelry_scene` | 场景合成 |
| `jewelry_macro_detail` | 微距细节 |

### 2.3 任务状态 `taskStatus`

| 值 | 含义 |
|---|---|
| `draft` | 草稿 |
| `created` | 已创建 |
| `uploading` | 上传中 |
| `queued` | 排队中 |
| `running` | 生成中 |
| `downloading` | 下载中 |
| `succeeded` | 成功 |
| `failed` | 失败 |
| `cancelled` | 已取消 |

### 2.4 话题状态 `topicStatus`

| 值 | 含义 |
|---|---|
| `draft` | 草稿 |
| `scheduled` | 待开始 |
| `active` | 进行中 |
| `reviewing` | 结算审核中 |
| `ended` | 已结束 |
| `cancelled` | 已取消 |

### 2.5 作品状态 `postStatus`

| 值 | 含义 |
|---|---|
| `pending` | 待审核 |
| `published` | 已发布 |
| `rejected` | 审核拒绝 |
| `hidden` | 已隐藏 |
| `deleted` | 已删除 |

### 2.6 积分流水类型 `pointType`

| 值 | 含义 |
|---|---|
| `recharge` | 充值获得 |
| `consume` | 创作消耗 |
| `reward` | 活动奖励 |
| `refund` | 失败退回 |
| `adjustment` | 后台调整 |

---

## 3. 数据模型

### 3.1 User

```json
{
  "id": "usr_xxx",
  "nickname": "Beta Tester",
  "avatarUrl": "https://...",
  "role": "user",
  "pointBalance": 999999,
  "createdAt": "2026-05-01T10:30:00+08:00"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `id` | string | 是 | 用户 ID |
| `nickname` | string | 是 | 昵称 |
| `avatarUrl` | string | 否 | 头像 |
| `role` | string | 是 | `userRole` |
| `pointBalance` | number | 是 | 可用积分 |
| `createdAt` | string | 是 | 注册时间 |

### 3.2 ImageTask

```json
{
  "id": "task_xxx",
  "userId": "usr_xxx",
  "taskType": "jewelry_scene",
  "workflowTemplate": "jewelry_scene",
  "status": "succeeded",
  "inputImages": ["https://.../input.png"],
  "outputImages": ["https://.../output.png"],
  "prompt": "深蓝丝绒衬底，柔和棚拍光，高级目录风",
  "promptSummary": "深蓝丝绒衬底，柔和棚拍光",
  "params": {
    "width": 1024,
    "height": 1024,
    "steps": 12,
    "cfg": 8,
    "paddingRatio": 0.08
  },
  "pointCost": 10,
  "errorCode": null,
  "errorMessage": null,
  "createdAt": "2026-05-01T10:30:00+08:00",
  "updatedAt": "2026-05-01T10:31:00+08:00"
}
```

### 3.3 Topic

```json
{
  "id": "topic_xxx",
  "title": "珠宝白底图挑战",
  "tag": "珠宝白底图",
  "description": "使用平台抠图白底能力生成商用商品图",
  "coverUrl": "https://...",
  "status": "active",
  "startAt": "2026-05-01T00:00:00+08:00",
  "endAt": "2026-05-07T23:59:59+08:00",
  "rewardRules": [
    { "rankStart": 1, "rankEnd": 1, "points": 1000 },
    { "rankStart": 2, "rankEnd": 3, "points": 500 },
    { "rankStart": 4, "rankEnd": 10, "points": 100 }
  ],
  "postCount": 128,
  "createdAt": "2026-05-01T00:00:00+08:00"
}
```

### 3.4 Post

```json
{
  "id": "post_xxx",
  "topicId": "topic_xxx",
  "userId": "usr_xxx",
  "imageTaskId": "task_xxx",
  "imageUrl": "https://.../output.png",
  "caption": "深蓝丝绒珠宝商拍图",
  "taskType": "jewelry_scene",
  "workflowTemplate": "jewelry_scene",
  "promptSummary": "深蓝丝绒衬底，柔和棚拍光",
  "aiLabel": true,
  "status": "published",
  "likeCount": 100,
  "commentCount": 20,
  "favoriteCount": 15,
  "shareCount": 8,
  "score": 92.5,
  "rank": 1,
  "createdAt": "2026-05-01T10:30:00+08:00"
}
```

### 3.5 Comment

```json
{
  "id": "cmt_xxx",
  "postId": "post_xxx",
  "userId": "usr_xxx",
  "content": "质感很好，适合电商主图。",
  "status": "published",
  "createdAt": "2026-05-01T10:30:00+08:00"
}
```

### 3.6 PointLedger

```json
{
  "id": "pl_xxx",
  "userId": "usr_xxx",
  "type": "consume",
  "amount": -10,
  "balanceAfter": 999989,
  "relatedId": "task_xxx",
  "remark": "生成图片消耗",
  "createdAt": "2026-05-01T10:30:00+08:00"
}
```

---

## 4. 认证与用户

### 4.1 登录

```http
POST /auth/login
```

#### Request

```json
{
  "loginType": "code",
  "phone": "13800000000",
  "code": "123456"
}
```

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "accessToken": "eyJxxx",
    "refreshToken": "eyJxxx",
    "expiresIn": 7200,
    "user": {
      "id": "usr_xxx",
      "nickname": "Beta Tester",
      "avatarUrl": "https://...",
      "role": "user",
      "pointBalance": 999999
    }
  }
}
```

### 4.2 刷新 Token

```http
POST /auth/refresh
```

#### Request

```json
{
  "refreshToken": "eyJxxx"
}
```

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "accessToken": "eyJxxx",
    "expiresIn": 7200
  }
}
```

### 4.3 获取当前用户

```http
GET /users/me
```

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "usr_xxx",
    "nickname": "Beta Tester",
    "avatarUrl": "https://...",
    "role": "user",
    "pointBalance": 999999,
    "createdAt": "2026-05-01T10:30:00+08:00"
  }
}
```

---

## 5. 文件上传

### 5.1 上传图片

```http
POST /files/images
Content-Type: multipart/form-data
```

#### FormData

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `file` | File | 是 | JPG / PNG / WEBP |
| `scene` | string | 否 | `task_input` / `avatar` / `post_cover` |

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "fileId": "file_xxx",
    "url": "https://.../image.png",
    "filename": "image.png",
    "mimeType": "image/png",
    "size": 1024000,
    "width": 1024,
    "height": 1024
  }
}
```

---

## 6. AI 创作任务

### 6.1 获取任务模板列表

```http
GET /ai/templates
```

#### Query

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `taskType` | string | 否 | 任务类型 |

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "id": "tpl_jewelry_scene",
      "name": "珠宝场景合成",
      "taskType": "jewelry_scene",
      "workflowTemplate": "jewelry_scene",
      "description": "将珠宝置入高级商拍场景",
      "defaultCost": 10,
      "defaultParams": {
        "width": 1024,
        "height": 1024,
        "steps": 12,
        "cfg": 8,
        "paddingRatio": 0.08
      }
    }
  ]
}
```

### 6.2 预估积分消耗

```http
POST /ai/tasks/estimate
```

#### Request

```json
{
  "taskType": "jewelry_scene",
  "workflowTemplate": "jewelry_scene",
  "inputImageIds": ["file_xxx"],
  "params": {
    "width": 1024,
    "height": 1024,
    "steps": 12,
    "cfg": 8
  }
}
```

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "estimatedCost": 10,
    "currentBalance": 999999,
    "enough": true
  }
}
```

### 6.3 创建并提交任务

```http
POST /ai/tasks
```

#### Request

```json
{
  "taskType": "jewelry_scene",
  "workflowTemplate": "jewelry_scene",
  "inputImageIds": ["file_xxx"],
  "prompt": "深蓝丝绒衬底，柔和棚拍光，高级目录风",
  "negativePrompt": "模糊，畸变，低质，主体变形",
  "params": {
    "width": 1024,
    "height": 1024,
    "steps": 12,
    "cfg": 8,
    "paddingRatio": 0.08
  }
}
```

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "task_xxx",
    "status": "queued",
    "taskType": "jewelry_scene",
    "workflowTemplate": "jewelry_scene",
    "pointCost": 10,
    "createdAt": "2026-05-01T10:30:00+08:00"
  }
}
```

### 6.4 查询任务详情

```http
GET /ai/tasks/{taskId}
```

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "task_xxx",
    "taskType": "jewelry_scene",
    "workflowTemplate": "jewelry_scene",
    "status": "succeeded",
    "progress": 100,
    "inputImages": ["https://.../input.png"],
    "outputImages": ["https://.../output.png"],
    "promptSummary": "深蓝丝绒衬底，柔和棚拍光",
    "pointCost": 10,
    "errorCode": null,
    "errorMessage": null,
    "createdAt": "2026-05-01T10:30:00+08:00",
    "updatedAt": "2026-05-01T10:31:00+08:00"
  }
}
```

### 6.5 查询任务列表 / 历史记录

```http
GET /ai/tasks
```

#### Query

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `status` | string | 否 | 任务状态 |
| `taskType` | string | 否 | 任务类型 |
| `page` | number | 否 | 默认 `1` |
| `pageSize` | number | 否 | 默认 `20` |

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": "task_xxx",
        "taskType": "jewelry_scene",
        "status": "succeeded",
        "thumbnailUrl": "https://.../thumb.png",
        "promptSummary": "深蓝丝绒衬底，柔和棚拍光",
        "createdAt": "2026-05-01T10:30:00+08:00"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "hasMore": false
  }
}
```

### 6.6 取消任务

```http
POST /ai/tasks/{taskId}/cancel
```

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "task_xxx",
    "status": "cancelled"
  }
}
```

---

## 7. 话题挑战

### 7.1 获取话题列表

```http
GET /topics
```

#### Query

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `status` | string | 否 | `active` / `ended` / `scheduled` |
| `keyword` | string | 否 | 搜索词 |
| `page` | number | 否 | 默认 `1` |
| `pageSize` | number | 否 | 默认 `20` |

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": "topic_xxx",
        "title": "珠宝白底图挑战",
        "tag": "珠宝白底图",
        "coverUrl": "https://...",
        "status": "active",
        "startAt": "2026-05-01T00:00:00+08:00",
        "endAt": "2026-05-07T23:59:59+08:00",
        "postCount": 128,
        "rewardPool": 10000
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "hasMore": false
  }
}
```

### 7.2 获取话题详情

```http
GET /topics/{topicId}
```

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "topic_xxx",
    "title": "珠宝白底图挑战",
    "tag": "珠宝白底图",
    "description": "使用平台抠图白底能力生成商用商品图",
    "coverUrl": "https://...",
    "status": "active",
    "startAt": "2026-05-01T00:00:00+08:00",
    "endAt": "2026-05-07T23:59:59+08:00",
    "allowedTaskTypes": ["jewelry_product_cutout", "jewelry_retouch"],
    "rewardRules": [
      { "rankStart": 1, "rankEnd": 1, "points": 1000 },
      { "rankStart": 2, "rankEnd": 3, "points": 500 }
    ],
    "postCount": 128,
    "mySubmitted": false
  }
}
```

### 7.3 创建话题

> 管理员接口。

```http
POST /admin/topics
```

#### Request

```json
{
  "title": "珠宝白底图挑战",
  "tag": "珠宝白底图",
  "description": "使用平台抠图白底能力生成商用商品图",
  "coverFileId": "file_xxx",
  "startAt": "2026-05-01T00:00:00+08:00",
  "endAt": "2026-05-07T23:59:59+08:00",
  "allowedTaskTypes": ["jewelry_product_cutout", "jewelry_retouch"],
  "rewardRules": [
    { "rankStart": 1, "rankEnd": 1, "points": 1000 },
    { "rankStart": 2, "rankEnd": 3, "points": 500 },
    { "rankStart": 4, "rankEnd": 10, "points": 100 }
  ],
  "scoreRule": {
    "likeWeight": 0.25,
    "commentWeight": 0.15,
    "qualityWeight": 0.4,
    "matchWeight": 0.1,
    "antiCheatWeight": 0.1
  }
}
```

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "topic_xxx",
    "status": "scheduled"
  }
}
```

---

## 8. 作品社区

### 8.1 发布作品到话题

```http
POST /topics/{topicId}/posts
```

#### Request

```json
{
  "imageTaskId": "task_xxx",
  "caption": "深蓝丝绒珠宝商拍图",
  "publicPrompt": false
}
```

#### 校验规则

| 规则 | 说明 |
|---|---|
| 任务归属 | `imageTaskId` 必须属于当前用户 |
| 任务状态 | 仅 `succeeded` 可发布 |
| 作品来源 | 仅本平台生成 / 编辑任务可参赛 |
| 话题状态 | 仅 `active` 可投稿 |
| 任务类型 | 必须在 `allowedTaskTypes` 内 |
| AI 标识 | 公开展示默认 `aiLabel = true` |

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "post_xxx",
    "status": "pending"
  }
}
```

### 8.2 获取作品列表

```http
GET /topics/{topicId}/posts
```

#### Query

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `sort` | string | 否 | `latest` / `hot` / `rank` |
| `page` | number | 否 | 默认 `1` |
| `pageSize` | number | 否 | 默认 `20` |

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": "post_xxx",
        "topicId": "topic_xxx",
        "user": {
          "id": "usr_xxx",
          "nickname": "Beta Tester",
          "avatarUrl": "https://..."
        },
        "imageUrl": "https://.../output.png",
        "caption": "深蓝丝绒珠宝商拍图",
        "taskType": "jewelry_scene",
        "aiLabel": true,
        "likeCount": 100,
        "commentCount": 20,
        "favoriteCount": 15,
        "score": 92.5,
        "rank": 1,
        "liked": false,
        "favorited": false,
        "createdAt": "2026-05-01T10:30:00+08:00"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "hasMore": false
  }
}
```

### 8.3 获取作品详情

```http
GET /posts/{postId}
```

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "post_xxx",
    "topicId": "topic_xxx",
    "user": {
      "id": "usr_xxx",
      "nickname": "Beta Tester",
      "avatarUrl": "https://..."
    },
    "imageUrl": "https://.../output.png",
    "caption": "深蓝丝绒珠宝商拍图",
    "taskType": "jewelry_scene",
    "workflowTemplate": "jewelry_scene",
    "promptSummary": "深蓝丝绒衬底，柔和棚拍光",
    "aiLabel": true,
    "likeCount": 100,
    "commentCount": 20,
    "favoriteCount": 15,
    "shareCount": 8,
    "score": 92.5,
    "rank": 1,
    "liked": false,
    "favorited": false,
    "createdAt": "2026-05-01T10:30:00+08:00"
  }
}
```

### 8.4 删除作品

```http
DELETE /posts/{postId}
```

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "post_xxx",
    "status": "deleted"
  }
}
```

---

## 9. 互动

### 9.1 点赞 / 取消点赞

```http
POST /posts/{postId}/like
DELETE /posts/{postId}/like
```

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "postId": "post_xxx",
    "liked": true,
    "likeCount": 101
  }
}
```

### 9.2 收藏 / 取消收藏

```http
POST /posts/{postId}/favorite
DELETE /posts/{postId}/favorite
```

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "postId": "post_xxx",
    "favorited": true,
    "favoriteCount": 16
  }
}
```

### 9.3 评论作品

```http
POST /posts/{postId}/comments
```

#### Request

```json
{
  "content": "质感很好，适合电商主图。"
}
```

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "cmt_xxx",
    "postId": "post_xxx",
    "content": "质感很好，适合电商主图。",
    "status": "published",
    "createdAt": "2026-05-01T10:30:00+08:00"
  }
}
```

### 9.4 获取评论列表

```http
GET /posts/{postId}/comments
```

#### Query

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `page` | number | 否 | 默认 `1` |
| `pageSize` | number | 否 | 默认 `20` |

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": "cmt_xxx",
        "user": {
          "id": "usr_xxx",
          "nickname": "Beta Tester",
          "avatarUrl": "https://..."
        },
        "content": "质感很好，适合电商主图。",
        "createdAt": "2026-05-01T10:30:00+08:00"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "hasMore": false
  }
}
```

---

## 10. 排行榜与评分

### 10.1 获取话题排行榜

```http
GET /topics/{topicId}/ranking
```

#### Query

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `page` | number | 否 | 默认 `1` |
| `pageSize` | number | 否 | 默认 `50` |

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "rank": 1,
        "postId": "post_xxx",
        "imageUrl": "https://.../output.png",
        "user": {
          "id": "usr_xxx",
          "nickname": "Beta Tester"
        },
        "score": 92.5,
        "scoreDetail": {
          "qualityScore": 40,
          "interactionScore": 30,
          "matchScore": 10,
          "antiCheatScore": 12.5
        },
        "rewardPoints": 1000
      }
    ],
    "page": 1,
    "pageSize": 50,
    "total": 1,
    "hasMore": false
  }
}
```

### 10.2 手动刷新评分

> 管理员接口。

```http
POST /admin/topics/{topicId}/score/recalculate
```

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "topicId": "topic_xxx",
    "recalculated": true,
    "affectedPosts": 128
  }
}
```

### 10.3 结算话题奖励

> 管理员接口；必须使用 `Idempotency-Key`。

```http
POST /admin/topics/{topicId}/settle
```

#### Request

```json
{
  "confirm": true
}
```

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "topicId": "topic_xxx",
    "status": "ended",
    "rewardedUsers": 10,
    "totalRewardPoints": 3000
  }
}
```

---

## 11. 积分系统

### 11.1 获取积分余额

```http
GET /points/balance
```

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "userId": "usr_xxx",
    "balance": 999999,
    "rechargePoints": 900000,
    "rewardPoints": 99999
  }
}
```

### 11.2 获取积分流水

```http
GET /points/ledger
```

#### Query

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `type` | string | 否 | `pointType` |
| `page` | number | 否 | 默认 `1` |
| `pageSize` | number | 否 | 默认 `20` |

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": "pl_xxx",
        "type": "consume",
        "amount": -10,
        "balanceAfter": 999989,
        "relatedId": "task_xxx",
        "remark": "生成图片消耗",
        "createdAt": "2026-05-01T10:30:00+08:00"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "hasMore": false
  }
}
```

### 11.3 创建充值订单

```http
POST /payments/orders
```

#### Request

```json
{
  "packageId": "pkg_1000_points",
  "payChannel": "wechat"
}
```

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "orderId": "ord_xxx",
    "packageId": "pkg_1000_points",
    "amount": 9.9,
    "points": 1000,
    "payChannel": "wechat",
    "payParams": {}
  }
}
```

### 11.4 查询订单状态

```http
GET /payments/orders/{orderId}
```

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "orderId": "ord_xxx",
    "status": "paid",
    "amount": 9.9,
    "points": 1000,
    "paidAt": "2026-05-01T10:30:00+08:00"
  }
}
```

---

## 12. 内容治理

### 12.1 举报作品 / 评论

```http
POST /reports
```

#### Request

```json
{
  "targetType": "post",
  "targetId": "post_xxx",
  "reason": "suspected_infringement",
  "description": "疑似盗用他人图片"
}
```

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "report_xxx",
    "status": "pending"
  }
}
```

### 12.2 审核队列

> 管理员接口。

```http
GET /admin/moderation/items
```

#### Query

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `targetType` | string | 否 | `post` / `comment` / `topic` |
| `status` | string | 否 | `pending` / `approved` / `rejected` |
| `page` | number | 否 | 默认 `1` |
| `pageSize` | number | 否 | 默认 `20` |

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": "mod_xxx",
        "targetType": "post",
        "targetId": "post_xxx",
        "riskType": "ai_content",
        "status": "pending",
        "createdAt": "2026-05-01T10:30:00+08:00"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "hasMore": false
  }
}
```

### 12.3 审核通过 / 拒绝

```http
POST /admin/moderation/items/{itemId}/review
```

#### Request

```json
{
  "action": "approve",
  "reason": ""
}
```

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "mod_xxx",
    "status": "approved"
  }
}
```

---

## 13. 服务状态

### 13.1 健康检查

```http
GET /system/health
```

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "status": "ready",
    "version": "1.0.0",
    "comfyui": {
      "available": true,
      "queueSize": 0
    },
    "storage": {
      "available": true
    },
    "database": {
      "available": true
    }
  }
}
```

### 13.2 获取系统配置

```http
GET /system/config
```

#### Response

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "maxUploadSizeMb": 20,
    "supportedImageTypes": ["jpg", "jpeg", "png", "webp"],
    "aiLabelRequired": true,
    "defaultPageSize": 20
  }
}
```

---

## 14. 前端对接清单

| 页面 / 模块 | 必需接口 |
|---|---|
| 登录页 | `POST /auth/login` |
| 首页 | `GET /ai/templates`、`GET /topics?status=active`、`GET /users/me` |
| 创作页 | `POST /files/images`、`POST /ai/tasks/estimate`、`POST /ai/tasks` |
| 任务进度页 | `GET /ai/tasks/{taskId}` |
| 结果页 | `GET /ai/tasks/{taskId}`、`POST /topics/{topicId}/posts` |
| 历史记录页 | `GET /ai/tasks` |
| 话题列表页 | `GET /topics` |
| 话题详情页 | `GET /topics/{topicId}`、`GET /topics/{topicId}/posts` |
| 作品详情页 | `GET /posts/{postId}`、`GET /posts/{postId}/comments` |
| 排行榜页 | `GET /topics/{topicId}/ranking` |
| 积分页 | `GET /points/balance`、`GET /points/ledger`、`POST /payments/orders` |
| 设置页 | `GET /system/health`、`GET /system/config` |

---

## 15. 后端实现清单

| 模块 | 必做能力 |
|---|---|
| Auth | 登录、刷新 Token、用户上下文 |
| File | 图片上传、格式校验、尺寸读取、对象存储 |
| AI Task | 任务创建、积分预扣、ComfyUI 调用、状态轮询、失败退分 |
| Template | 工作流模板管理、参数注入、参数校验 |
| Topic | 话题创建、状态流转、奖励规则 |
| Post | 作品发布、平台来源校验、AI 标识 |
| Interaction | 点赞、收藏、评论、分享计数 |
| Ranking | 综合评分、榜单、反作弊权重 |
| Point | 积分余额、流水、充值、奖励、退款 |
| Payment | 订单创建、支付回调、幂等处理 |
| Moderation | 审核、举报、下架、防刷 |
| System | 健康检查、配置下发、日志追踪 |

---

## 16. 待确认项

| 项 | 当前状态 | 负责人 | 截止时间 |
|---|---|---|---|
| 登录方式 | TODO | TODO | TODO |
| 支付方式 | TODO | TODO | TODO |
| 对象存储方案 | TODO | TODO | TODO |
| ComfyUI 服务部署地址 | TODO | TODO | TODO |
| 积分单价 | TODO | TODO | TODO |
| 单次生成积分消耗规则 | TODO | TODO | TODO |
| 评分公式最终权重 | TODO | TODO | TODO |
| 内容审核策略 | TODO | TODO | TODO |
| 是否开放外部图片投稿 | 建议否 | TODO | TODO |
| 是否公开提示词 | 建议用户可选 | TODO | TODO |

---

## 17. 版本记录

| 版本 | 日期 | 修改内容 | 修改人 |
|---|---|---|---|
| 0.1.0 | TODO | 初版 | TODO |
