# OpenChat

[中文](#中文说明) | [English](#english)

## 中文说明

OpenChat 是一个多模型 AI 工作区，可以让同一个提示词同时交给多个 AI 朋友回答，在共享聊天界面中对比结果，并生成一条综合回复。

### 概览

- 支持两种运行模式：`frontend` 和 `backend`
- `frontend` 模式为纯浏览器运行，状态存储在 `localStorage`
- `backend` 模式使用 Node.js 服务端持久化，并提供 `/api/*` 路由
- 同一套多页面 UI 可在两种模式之间切换使用

### 功能

- 在同一会话中让多个 AI 朋友同时响应一个提示词
- 为每个朋友绑定模型配置、头像和独立系统提示词
- 选择哪些朋友参与当前会话
- 选择一个综合朋友输出最终合并回复
- 为当前会话配置共享系统提示词
- 通过后端以增量方式流式返回响应
- 保存、重命名、置顶、分享和删除历史会话
- 在中文和英文界面之间切换
- 使用浏览器本地存储或后端 JSON 持久化
- 在提供商未完整配置时回退到 mock 响应，保持界面可用

### 页面

- `index.html` - 主工作区和多朋友聊天界面
- `settings.html` - 模型路由、提供商设置、运行模式
- `friends.html` - AI 朋友管理
- `auth.html` - 本地账号注册入口
- `history.html` - 历史会话列表

### 快速开始

安装依赖：

```bash
npm install
```

前端开发模式：

```bash
npm run dev
```

启动后端服务：

```bash
npm run start
```

后端开发模式：

```bash
npm run dev:server
```

默认端口：

- Vite 前端：`http://127.0.0.1:4173`
- Node 后端：`http://127.0.0.1:8787`

### 前端密码门

`frontend` 模式可以在页面可用前增加一个全局密码校验。

- 密码以 `MD5` 进行比对
- 解锁状态保存在 `localStorage`，同一浏览器中可长期生效
- `backend` 模式不受这层仅前端使用的密码门限制

配置优先级：

1. `VITE_FRONTEND_PASSWORD_MD5` 环境变量
2. `public/frontend-auth.json`

托管前端构建，例如 Vercel：

```bash
VITE_FRONTEND_PASSWORD_MD5=<your-md5-hash>
```

Create or update:

`public/frontend-auth.json`

Expected shape:

```json
{
  "frontendPasswordMd5": "<md5-hash>"
}
```

Do not commit a real password hash that you actively use.

You can generate an MD5 hash with Node:

```bash
node -e "console.log(require('crypto').createHash('md5').update('your-password').digest('hex'))"
```

不要提交你正在实际使用的真实密码哈希。

### 本地引导

`frontend` 模式首次使用时，如果浏览器的 `localStorage` 中还没有模型配置，会自动加载 `public/openchat.local-models.json`。

- 该文件用于本地初始化和演示环境引导
- 浏览器中已保存的模型配置不会被覆盖
- 如果需要重新应用该文件，清除 `localStorage` 中保存的模型配置键即可

当前本地引导文件：

- `public/openchat.local-models.json`

对于 OpenAI-compatible 网关，建议填写完整 API base path，通常以 `/v1` 结尾。

### 构建与测试

构建：

```bash
npm run build
npm run preview
```

运行完整测试：

```bash
npm test
```

运行单个测试文件：

```bash
node --test frontend-auth.test.mjs
```

按名称筛选测试：

```bash
node --test --test-name-pattern="frontend password" frontend-auth.test.mjs
```

### 架构

#### `frontend` 模式

- 在 `localStorage` 中保存账号、模型、朋友、群组设置和历史会话
- 未配置真实端点时可使用 mock 响应
- 与 `backend` 模式共享同一套页面结构和交互模型

#### `backend` 模式

- 由 `server.mjs` 提供静态文件和 `/api/*` 路由
- 数据持久化到 `.data/openchat-db.json`
- 通过换行分隔 JSON 流传输运行结果
- 在服务端保存账号、模型、朋友、默认群组设置和会话数据

#### 核心文件

- `script.js` - 前端应用逻辑、i18n、渲染、运行模式切换、状态同步
- `styles.css` - 全部应用样式
- `server.mjs` - 自包含的 Node HTTP 服务与提供商适配层
- `vite.config.js` - Vite 配置

### 后端 API

当前后端暴露以下接口：

- `GET /api/account`
- `POST /api/auth/register`
- `GET /api/models`
- `POST /api/models`
- `GET /api/friends`
- `POST /api/friends`
- `GET /api/group-settings`
- `POST /api/group-settings`
- `GET /api/conversations`
- `POST /api/conversations`
- `POST /api/chat/run`
- `POST /api/chat/run/stream`

### 数据存储

后端持久化文件位置：

- `.data/openchat-db.json`

存储结构示例：

```json
{
  "account": null,
  "models": [],
  "friends": [],
  "groupSettings": {},
  "conversations": []
}
```

历史会话最多保留最近 50 条。

### 部署

静态前端输出：

- Vercel：使用 `npm run build`，输出目录为 `dist`
- Cloudflare Pages：使用 `npm run build`，输出目录为 `dist`

Node 后端：

- 运行 `node server.mjs`
- 如果希望直接使用 `/api/*` 路由而不额外配置代理，前后端应部署在同一 origin 下

### 说明

- 自动化测试使用 Node 内置测试运行器，测试文件位于仓库根目录的 `*.test.mjs`
- 当前后端使用 JSON 文件持久化，定位为轻量级 MVP
- 后端内置适配器覆盖 OpenAI-compatible APIs、Anthropic 和 Gemini
- 在 `backend` 模式下，历史编辑会通过 `POST /api/conversations` 回写到服务端
- 如果后端加载失败，界面会回退到 `frontend` 模式以保持本地状态可用
- `vendor/ai-search-hub` 可作为可选后端桥接接入 AI Search Hub
- 若要启用真实平台执行，需要在本地 `py` 环境中安装 Python Playwright，并确保目标平台站点可访问且已登录

## English

OpenChat is a multi-model AI workspace for sending the same prompt to multiple AI friends, comparing their answers in one shared chat UI, and generating a single synthesis reply.

### Overview

- Supports two runtime modes: `frontend` and `backend`
- `frontend` mode is browser-only and stores state in `localStorage`
- `backend` mode uses Node.js server persistence and exposes `/api/*` routes
- The same multi-page UI works across both modes

### Capabilities

- Run one prompt across multiple AI friends in the same conversation
- Bind each friend to a model config, avatar, and personal system prompt
- Choose which friends join the current conversation
- Pick one synthesis friend for the final merged answer
- Apply a shared system prompt to the current conversation
- Stream responses incrementally through the backend
- Save, rename, pin, share, and delete conversation history
- Switch between Chinese and English
- Use browser-local persistence or backend JSON persistence
- Fall back to mock responses when a provider is not fully configured so the UI stays usable

### Pages

- `index.html` - main workspace and multi-friend chat UI
- `settings.html` - model routing, provider settings, runtime mode
- `friends.html` - AI friend management
- `auth.html` - local account registration entry
- `history.html` - stored conversation history

### Getting Started

Install dependencies:

```bash
npm install
```

Frontend development:

```bash
npm run dev
```

Start the backend server:

```bash
npm run start
```

Backend development mode:

```bash
npm run dev:server
```

Default ports:

- Vite frontend: `http://127.0.0.1:4173`
- Node backend: `http://127.0.0.1:8787`

### Password Gate

`frontend` mode can require a global password check before any page becomes usable.

- Passwords are compared with `MD5`
- The unlocked state is stored in `localStorage`, so it stays valid in the same browser
- `backend` mode is not gated by this frontend-only password layer

Configuration priority:

1. `VITE_FRONTEND_PASSWORD_MD5` environment variable
2. `public/frontend-auth.json`

Hosted frontend builds such as Vercel:

```bash
VITE_FRONTEND_PASSWORD_MD5=<your-md5-hash>
```

For local deployment, edit:

`public/frontend-auth.json`

Example:

```json
{
  "frontendPasswordMd5": "<md5-hash>"
}
```

Generate an MD5 hash with Node:

```bash
node -e "console.log(require('crypto').createHash('md5').update('your-password').digest('hex'))"
```

Do not commit a real password hash that you actively use.

### Local Bootstrap

On first use in `frontend` mode, `public/openchat.local-models.json` is auto-loaded when the browser does not already have model configs in `localStorage`.

- This file is intended for local bootstrap and demo setup
- Existing saved model configs in the browser are not overwritten
- To re-apply the file, clear the saved model config key from `localStorage`

Current local bootstrap file:

- `public/openchat.local-models.json`

For OpenAI-compatible gateways, prefer the full API base path, usually ending in `/v1`.

### Build/Test

Build:

```bash
npm run build
npm run preview
```

Run the full test suite:

```bash
npm test
```

Run a single test file:

```bash
node --test frontend-auth.test.mjs
```

Run tests by name:

```bash
node --test --test-name-pattern="frontend password" frontend-auth.test.mjs
```

### Architecture

#### `frontend` Mode

- Keeps account, models, friends, group settings, and conversation history in `localStorage`
- Can use mock responses when no live endpoint is configured
- Uses the same pages and interaction model as `backend` mode

#### `backend` Mode

- Serves static files and `/api/*` routes from `server.mjs`
- Persists data to `.data/openchat-db.json`
- Streams run output through newline-delimited JSON
- Stores account, models, friends, default group settings, and conversations on the server

#### Core Files

- `script.js` - frontend app logic, i18n, rendering, runtime switching, state sync
- `styles.css` - all application styling
- `server.mjs` - self-contained Node HTTP server and provider adapters
- `vite.config.js` - Vite configuration

### Backend API

The current backend exposes:

- `GET /api/account`
- `POST /api/auth/register`
- `GET /api/models`
- `POST /api/models`
- `GET /api/friends`
- `POST /api/friends`
- `GET /api/group-settings`
- `POST /api/group-settings`
- `GET /api/conversations`
- `POST /api/conversations`
- `POST /api/chat/run`
- `POST /api/chat/run/stream`

### Data Storage

Backend persistence lives in:

- `.data/openchat-db.json`

Stored shape:

```json
{
  "account": null,
  "models": [],
  "friends": [],
  "groupSettings": {},
  "conversations": []
}
```

Conversation history is capped to the most recent 50 entries.

### Deploy

Static frontend output:

- Vercel: build with `npm run build`, output `dist`
- Cloudflare Pages: build with `npm run build`, output `dist`

Node backend:

- Run `node server.mjs`
- Serve the frontend and backend from the same origin if you want `/api/*` routes without extra proxy setup

### Notes

- Automated tests use the Node built-in test runner and live in repo-root `*.test.mjs` files
- The backend currently uses JSON-file persistence for a lightweight MVP
- The backend includes adapters for OpenAI-compatible APIs, Anthropic, and Gemini
- In `backend` mode, history edits sync back to the server through `POST /api/conversations`
- If backend loading fails, the UI falls back to `frontend` mode so local state remains usable
- `vendor/ai-search-hub` can be vendored as an optional backend bridge for AI Search Hub
- To enable real platform execution, install Python Playwright in the local `py` environment and ensure the target platform site is reachable and logged in
