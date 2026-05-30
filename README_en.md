# OpenChat

[中文](./README.md)

OpenChat is a multi-model AI collaboration workspace. You can send the same prompt to multiple models at the same time, compare their responses in one place, and let a designated AI synthesize the final answer. It works well for solution comparison, group-style discussion, role-based collaboration, and conclusion merging.

## Live Demo

- Demo: https://openchat.sumsec.me/

## Core Features

- **Parallel multi-model chat**: Send one prompt to multiple AI friends at once and review their answers side by side.
- **AI synthesis expert**: Assign one friend as the synthesis role to merge multi-model outputs into a single conclusion.
- **Friend orchestration and role setup**: Configure each AI friend with its own model, avatar, description, and system prompt.
- **Group settings**: Manage shared system prompts, member selection, and platform capability preferences at the conversation level.
- **Streaming message rendering**: View responses as they are generated, which works especially well for long text, code blocks, and step-by-step output.
- **Stop anytime**: Interrupt the current run while it streams; the content already produced is kept.
- **Per-message actions**: Regenerate any model answer (retry on failure) and edit-and-resend user messages.
- **Image / multimodal input**: Attach images alongside your prompt for vision-capable models (works in both runtime modes).
- **Markdown / code highlight / Mermaid / math**: Enhanced rendering for AI-generated content so complex replies stay readable.
- **Reasoning collapse**: Automatically folds `<think>` and reasoning content to reduce noise in the main chat view.
- **Conversation history**: Save, browse, and manage previous sessions for follow-up questions and review.
- **Dual runtime modes**: Supports both frontend-only mode and Node.js backend mode for lightweight deployment or server-side persistence.
- **Model configuration center**: Manage provider, model, base URL, API key, and enabled state in one place.
- **Themes / font size / bilingual UI**: Includes multiple themes, adjustable font size, and Chinese/English interface switching.
- **Frontend access password**: Adds a lightweight access gate for public deployments.

## Screenshots

### 1. Workspace: multi-model chat and synthesized answers

![OpenChat Workspace](./docs/images/workspace-main.jpg)

### 2. Settings: runtime mode, theme, and model configuration

![OpenChat Settings](./docs/images/settings-main.jpg)

### 3. Friends: AI role setup and prompt configuration

![OpenChat Friends](./docs/images/friends-main.jpg)

## Pages

| Page | Path | Description |
|---|---|---|
| Workspace | `index.html` | Multi-model chat, synthesized answers, and streaming message flow |
| Settings | `settings.html` | Runtime mode, theme, font size, and model configuration |
| Friends | `friends.html` | AI friend management, role prompts, and model binding |
| Account | `auth.html` | Local account registration and account display |
| History | `history.html` | Conversation history browsing and management |

## Runtime Modes

### Frontend mode

- All data is stored in browser `localStorage`
- The browser calls model provider APIs directly
- Best for local use, static hosting, and quick deployment

### Backend mode

- A Node.js server provides `/api/*` routes
- Data is persisted to `.data/openchat-db.json`
- API keys are managed on the server
- Better for long-term use or centralized data storage

## Quick Start

### Install dependencies

```bash
npm install
```

### Start the frontend dev server

```bash
npm run dev
```

Visit: `http://127.0.0.1:4173`

### Start the backend server

```bash
npm run dev:server
```

Visit: `http://127.0.0.1:8787`

### Build output

```bash
npm run build
npm run preview
```

### Run tests

```bash
npm test

# Example single test file
node --test src/__tests__/frontend-auth.test.mjs
```

## Common Commands

```bash
npm install          # Install dependencies
npm run dev          # Start frontend dev server
npm run dev:server   # Start Node backend server
npm run build        # Build dist/
npm run preview      # Preview the build output
npm test             # Run tests
npm run start        # Start backend server
```

## Tech Stack

- **Frontend**: Vanilla JS + React 19
- **Styling**: Tailwind CSS v4
- **Components**: shadcn/ui + AI Elements
- **State management**: Zustand
- **Build tool**: Vite
- **Backend**: Native Node.js HTTP server
- **AI SDK**: Vercel AI SDK
- **Markdown rendering**: Streamdown
- **Testing**: Node built-in test runner

## Backend API

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

## Data Storage

In backend mode, data is stored by default in:

```text
.data/openchat-db.json
```

Main data includes:

- account
- models
- friends
- groupSettings
- conversations

## Deployment

### Static deployment

Suitable for Vercel, Cloudflare Pages, and other static hosting platforms:

```bash
npm run build
```

Output directory: `dist/`

### Deploy to Vercel

Vercel is a good fit for **Frontend mode** (pure static). OpenChat's Node backend is a self-hosted HTTP server and is not compatible with Vercel's serverless model, so use frontend mode on Vercel (API keys live in the browser, which calls model APIs directly).

**Option 1: Import a Git repository (recommended)**

1. Push the repo to GitHub / GitLab / Bitbucket.
2. In the Vercel dashboard, click **Add New… → Project** and import the repo.
3. Build settings (the repo ships a `vercel.json`, so these are usually pre-filled):
   - Framework Preset: `Vite` (or `Other`)
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Click **Deploy**. When it's live, open the assigned domain, go to `settings.html`, set the runtime mode to **Frontend**, and enter your model provider / Base URL / API key.

**Option 2: Use the Vercel CLI**

```bash
npm i -g vercel
vercel          # preview deployment
vercel --prod   # production deployment
```

> **Note:** Vercel domains are HTTPS. If a model's Base URL uses HTTP, the browser's Mixed Content policy will block it — see the FAQ below.

### Node server deployment

```bash
node server.mjs
```

Default port: `8787`

## FAQ

### HTTPS Page Cannot Request HTTP Model Endpoints (Mixed Content)

When OpenChat is deployed on an HTTPS domain and a model's Base URL uses HTTP, the browser blocks the request due to its Mixed Content security policy.

**Solution (Chrome):**

1. Open the page where the model endpoint is configured (e.g. `https://openchat.sumsec.me/settings.html`)
2. Click the lock icon (or `⚙` icon) to the left of the address bar
3. Select "Site settings"
4. Find the "Insecure content" option
5. Change it to "Allow"
6. Go back to the page and refresh

**Solution (CORS Extension):**

If you also encounter cross-origin (CORS) issues, install the Chrome extension [Allow CORS: Access-Control-Allow-Origin](https://chromewebstore.google.com/detail/lhobafahddgcelffkeicbaginigeejlf). Once enabled, it removes the browser's CORS restrictions.

**Solution (built-in CORS proxy):**

In **Settings → Runtime**, fill in the **CORS proxy** field (frontend mode only). Two formats are supported: a proxy prefix (e.g. `https://proxy/`, which becomes `https://proxy/<target-url>`) or a `{url}` placeholder (e.g. `https://proxy/?url={url}`). Once set, all direct model requests from the browser are routed through the proxy to bypass CORS. Leave it empty to disable.

> **Note:** These settings only apply to the current site and do not affect the security policy of other websites. Each browser must be configured separately.

## License

MIT
