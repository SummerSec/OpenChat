# OpenChat

[English](./README_en.md)

OpenChat 是一个多模型 AI 协作工作区。你可以把同一条问题同时发给多个模型，对比它们的回答，再由指定的 AI 负责整合输出，适合做方案对照、群聊讨论、角色协作和结论汇总。

## 在线体验

- 演示地址：https://openchat.sumsec.me/

## 核心功能

- **多模型并行对话**：同一条消息可同时发送给多个 AI 群友，集中查看不同模型的回答。
- **AI 整合专家**：可指定一位群友作为 synthesis 角色，自动汇总多模型输出并生成综合结论。
- **群友编排与角色设定**：支持为每个 AI 群友绑定模型、设置头像、描述和系统提示词。
- **群组设置**：支持共享系统提示词、成员选择、平台能力偏好等会话级配置。
- **流式消息渲染**：实时输出回答内容，适合长文本、代码块和逐步生成场景。
- **Markdown / 代码高亮 / Mermaid / 数学公式**：面向 AI 内容展示做了增强，便于阅读复杂回复。
- **思维链折叠展示**：自动识别 `<think>` 与 reasoning 内容，减少主界面噪音。
- **会话历史管理**：保存、浏览和管理历史对话，便于复盘与追问。
- **双运行模式**：支持纯前端模式和 Node.js 后端模式，兼顾轻量部署与服务端持久化。
- **模型配置中心**：统一管理 provider、model、base URL、API key 与启用状态。
- **主题 / 字号 / 中英文切换**：支持多主题外观、字体大小调节与双语界面。
- **前端访问密码**：适合公网部署时增加一道访问保护。

## 功能截图

### 1. 主工作区：多模型群聊与综合回答

![OpenChat 工作区](./docs/images/workspace-main.jpg)

### 2. 模型设置：运行模式、主题与模型配置

![OpenChat 模型设置](./docs/images/settings-main.jpg)

### 3. 群友管理：配置 AI 角色与系统提示词

![OpenChat 群友管理](./docs/images/friends-main.jpg)

## 页面说明

| 页面 | 路径 | 说明 |
|---|---|---|
| 主工作区 | `index.html` | 多模型对话、综合回答、消息流展示 |
| 模型设置 | `settings.html` | 运行模式、主题、字体、模型配置 |
| 群友管理 | `friends.html` | AI 群友管理、角色提示词、模型绑定 |
| 账号页面 | `auth.html` | 本地账号注册与展示 |
| 历史会话 | `history.html` | 历史记录浏览与管理 |

## 运行模式

### Frontend mode

- 所有数据保存在浏览器 `localStorage`
- 浏览器直接请求模型提供商接口
- 适合本地体验、静态托管和快速部署

### Backend mode

- Node.js 服务端提供 `/api/*` 路由
- 数据持久化到 `.data/openchat-db.json`
- API key 由服务端管理
- 更适合长期使用或需要统一数据存储的场景

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动前端开发环境

```bash
npm run dev
```

访问：`http://127.0.0.1:4173`

### 启动后端服务

```bash
npm run dev:server
```

访问：`http://127.0.0.1:8787`

### 构建产物

```bash
npm run build
npm run preview
```

### 运行测试

```bash
npm test

# 单测文件示例
node --test src/__tests__/frontend-auth.test.mjs
```

## 常用命令

```bash
npm install          # 安装依赖
npm run dev          # 前端开发服务
npm run dev:server   # Node 后端服务
npm run build        # 构建 dist/
npm run preview      # 预览构建结果
npm test             # 运行测试
npm run start        # 启动后端服务
```

## 技术栈

- **前端**：Vanilla JS + React 19
- **样式**：Tailwind CSS v4
- **组件**：shadcn/ui + AI Elements
- **状态管理**：Zustand
- **构建工具**：Vite
- **后端**：Node.js 原生 HTTP Server
- **AI SDK**：Vercel AI SDK
- **Markdown 渲染**：Streamdown
- **测试**：Node 内置测试运行器

## 后端 API

```text
GET  /api/account
POST /api/auth/register
GET  /api/models
POST /api/models
GET  /api/friends
POST /api/friends
GET  /api/group-settings
POST /api/group-settings
GET  /api/conversations
POST /api/conversations
POST /api/chat/run
POST /api/chat/run/stream
```

## 数据存储

后端模式下，数据默认保存在：

```text
.data/openchat-db.json
```

主要数据包括：

- account
- models
- friends
- groupSettings
- conversations

## 部署说明

### 静态部署

适合部署到 Vercel、Cloudflare Pages 等静态平台：

```bash
npm run build
```

产物目录：`dist/`

### Node 服务部署

```bash
node server.mjs
```

默认端口：`8787`

## 常见问题

### HTTPS 页面无法请求 HTTP 模型接口（Mixed Content）

当 OpenChat 部署在 HTTPS 域名下，而模型的 Base URL 为 HTTP 地址时，浏览器会因 Mixed Content 安全策略拦截请求。

**解决方法（Chrome）：**

1. 打开模型接口所在页面（如 `https://openchat.sumsec.me/settings.html`）
2. 点击地址栏左侧的锁头图标（或 `⚙` 图标）
3. 选择「网站设置」（Site settings）
4. 找到「不安全内容」（Insecure content）选项
5. 将其改为「允许」（Allow）
6. 返回页面并刷新

**解决方法（CORS 插件）：**

如果同时遇到跨域（CORS）问题，可安装 Chrome 插件 [Allow CORS: Access-Control-Allow-Origin](https://chromewebstore.google.com/detail/lhobafahddgcelffkeicbaginigeejlf)，启用后即可解除浏览器的 CORS 限制。

> **注意：** 以上设置仅对当前站点生效，不会影响其他网站的安全策略。每个浏览器需单独设置。

## 许可证

MIT
