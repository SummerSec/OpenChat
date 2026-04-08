# OpenChat

[English](./README_en.md)

OpenChat 是一个开源的多模型 AI 群聊工作区。将同一条消息同时发送给多个 AI 群友，在统一界面中对比各模型回答，并由 AI 整合专家生成综合回复。

## 特性

- **多模型群聊** — 一条消息同时发送给多个 AI 群友，实时流式显示各自回答
- **AI 整合专家** — 指定一位群友作为整合专家，自动汇总所有回答并生成综合结论
- **仅与专家对话** — 启用后跳过普通群友，仅与整合专家直接对话，支持多轮上下文
- **Markdown 渲染** — 基于 Streamdown 的实时 Markdown 渲染，支持代码高亮、数学公式、Mermaid 图表、CJK 优化
- **思维链折叠** — 自动识别 `<think>` 标签和 `reasoning_content`，流式展开/完成后折叠
- **复制按钮** — 所有群友消息生成完成后均可一键复制
- **多轮对话** — 每位群友独立维护对话历史，支持连续追问
- **群组管理** — 自由选择参与当前会话的群友组合，支持共享系统提示词
- **会话历史** — 保存、重命名、置顶、分享、删除历史会话
- **双语界面** — 中文 / 英文切换
- **双运行模式** — 纯前端模式（localStorage）或后端模式（Node.js 服务端持久化）
- **前端密码门** — 可选的 MD5 密码保护，适用于公网部署
- **Mock 回退** — 未配置 API Key 时自动使用模拟响应，保持界面可用

## 技术栈

| 层 | 技术 |
|---|------|
| 前端框架 | Vanilla JS + React 19（混合渲染） |
| 样式 | Tailwind CSS v4 |
| 组件库 | shadcn/ui + AI Elements |
| 状态管理 | Zustand |
| 构建工具 | Vite |
| 后端 | Node.js（原生 HTTP，无框架） |
| AI SDK | Vercel AI SDK |
| Markdown | Streamdown（流式渲染） |
| 测试 | Node 内置测试运行器 |

## 快速开始

### 安装依赖

```bash
npm install
```

### 前端开发模式

```bash
npm run dev
```

浏览器访问 `http://127.0.0.1:4173`

### 后端开发模式

```bash
npm run dev:server
```

浏览器访问 `http://127.0.0.1:8787`

### 构建

```bash
npm run build
npm run preview
```

### 运行测试

```bash
# 完整测试套件
npm test

# 单个测试文件
node --test src/__tests__/frontend-auth.test.mjs

# 按名称筛选
node --test --test-name-pattern="frontend password" src/__tests__/frontend-auth.test.mjs
```

## 页面结构

| 页面 | 路径 | 说明 |
|------|------|------|
| 主工作区 | `index.html` | 多群友聊天界面、消息发送、综合回复 |
| 模型设置 | `settings.html` | 模型提供商、API Key、Base URL、运行模式 |
| 群友管理 | `friends.html` | 添加/编辑 AI 群友、绑定模型、设置系统提示词 |
| 账号注册 | `auth.html` | 本地账号注册入口 |
| 历史会话 | `history.html` | 会话记录浏览与管理 |

## 架构

### 运行模式

**前端模式（Frontend）**

- 纯浏览器运行，所有状态存储在 `localStorage`
- API 请求直接从浏览器发往各模型提供商
- 适合个人使用或静态部署

**后端模式（Backend）**

- Node.js 服务端提供 `/api/*` 路由和静态文件服务
- 数据持久化到 `.data/openchat-db.json`
- 通过 NDJSON 流式传输响应
- API Key 在服务端管理，更安全

### 核心文件

| 文件 | 职责 |
|------|------|
| `src/script.js` | 前端主逻辑：i18n、渲染、状态管理、运行模式切换 |
| `src/styles.css` | 全部样式 |
| `server.mjs` | Node HTTP 服务器、API 路由、提供商适配器 |
| `vite.config.js` | Vite 构建配置 |
| `src/stores/chatStore.ts` | Zustand 状态管理（React 层） |
| `src/chat-main.tsx` | React 聊天组件挂载入口 |
| `src/components/chat/` | React 聊天组件（FriendChatCard、SynthesisCard 等） |
| `src/components/ai-elements/` | AI Elements 组件（Message、Reasoning、PromptInput 等） |

### 提供商适配器

后端内置三种 API 适配器：

| 适配器 | 适用提供商 |
|--------|-----------|
| `callOpenAICompatible` | OpenAI、xAI、Kimi、DeepSeek 及所有 OpenAI 兼容端点 |
| `callAnthropic` | Anthropic Claude |
| `callGemini` | Google Gemini |

前端模式下同样支持上述提供商的直接调用，并对 OpenAI 兼容端点提供流式输出。

## 后端 API

```
GET  /api/account              # 获取账号信息
POST /api/auth/register         # 注册账号
GET  /api/models                # 获取模型配置列表
POST /api/models                # 保存模型配置
GET  /api/friends               # 获取群友列表
POST /api/friends               # 保存群友列表
GET  /api/group-settings        # 获取群组设置
POST /api/group-settings        # 保存群组设置
GET  /api/conversations         # 获取历史会话
POST /api/conversations         # 保存历史会话
POST /api/chat/run              # 非流式运行
POST /api/chat/run/stream       # 流式运行（NDJSON）
```

## 数据存储

后端数据文件：`.data/openchat-db.json`

```json
{
  "account": null,
  "models": [],
  "friends": [],
  "groupSettings": {},
  "conversations": []
}
```

历史会话上限为最近 50 条。

## 配置

### 前端密码门

`frontend` 模式下可启用密码保护。配置优先级：

1. 环境变量 `VITE_FRONTEND_PASSWORD_MD5`
2. `public/frontend-auth.json`

```json
{
  "frontendPasswordMd5": "<md5-hash>"
}
```

生成 MD5 哈希：

```bash
node -e "console.log(require('crypto').createHash('md5').update('your-password').digest('hex'))"
```

### 本地模型引导

首次使用 `frontend` 模式时，如果 `localStorage` 中无模型配置，会自动加载 `public/openchat.local-models.json`。

- 该文件仅用于本地引导和演示
- 仓库中应保持空占位（`{"models":[]}`），不要提交真实 API Key
- 已有的浏览器模型配置不会被覆盖
- 对于 OpenAI 兼容网关，Base URL 通常以 `/v1` 结尾

## 部署

### 静态前端部署

适用于 Vercel、Cloudflare Pages 等：

```bash
npm run build
# 输出目录：dist
```

### 后端部署

```bash
node server.mjs
# 默认端口：8787
```

前后端部署在同一 origin 下可直接使用 `/api/*` 路由，无需额外代理。

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

## 补充说明

- 测试文件位于 `src/__tests/` 和 `features/` 目录，使用 Node 内置测试运行器
- 后端使用 JSON 文件持久化，适合轻量级场景
- 后端模式下的历史编辑会通过 `POST /api/conversations` 同步回服务端
- 后端加载失败时界面自动回退到前端模式，保持本地状态可用
- `vendor/ai-search-hub` 可作为可选后端桥接 AI Search Hub
- 平台执行功能需要本地安装 Python Playwright 并确保目标站点可访问

## 许可证

MIT
