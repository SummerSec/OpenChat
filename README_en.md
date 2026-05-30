# OpenChat

[中文](./README.md)

OpenChat is a multi-model AI collaboration workspace. You can send the same prompt to multiple models at once, compare their responses side by side, and — when you want — let a designated "synthesis expert" merge them into a single conclusion. It works well for solution comparison, group-style discussion, role-based collaboration, and conclusion merging.

## Live Demo

- Demo: https://openchat.sumsec.me/

## Core Features

- **Parallel multi-model chat**: Send one prompt to multiple AI friends at once and compare their answers side by side.
- **On-demand AI synthesis (synthesis expert)**: Assign one friend as the "synthesis expert". After comparing the answers, click **Synthesize** to generate a combined conclusion **on demand** — it summarizes only the latest round and uses the answer text only (no reasoning/thinking). The synthesis is kept and can serve as the basis for follow-up turns.
- **Expert-only chat**: When enabled, follow-up turns continue only with the synthesis expert, building on the existing synthesis/answer text instead of re-querying every friend.
- **Stop anytime**: Interrupt the current run while it streams; the content already produced is kept.
- **Per-message actions**: Regenerate any model answer (retry on failure) and edit-and-resend user messages.
- **Image / multimodal input**: Attach images alongside your prompt for vision-capable models (works in both runtime modes).
- **Friend orchestration and role setup**: Configure each AI friend with its own model, avatar, description, and system prompt.
- **Group settings**: Manage shared system prompts, member selection, and platform capability preferences at the conversation level.
- **Streaming message rendering**: View responses as they are generated, ideal for long text, code blocks, and step-by-step output.
- **Markdown / code highlight / Mermaid / math**: Enhanced rendering for AI-generated content so complex replies stay readable.
- **Reasoning collapse**: Automatically folds `<think>` and reasoning content to reduce noise in the main chat view.
- **Conversation history**: Save, browse, and manage previous sessions for follow-up questions and review.
- **Dual runtime modes**: Supports both frontend-only mode and Node.js backend mode for lightweight deployment or server-side persistence.
- **CORS proxy setting**: In frontend mode, configure a CORS proxy in Settings to bypass cross-origin restrictions when the browser calls model APIs directly.
- **Model configuration center**: Manage provider, model, base URL, API key, and enabled state in one place.
- **Themes / font size / bilingual UI**: Includes multiple themes, adjustable font size, and Chinese/English interface switching.
- **Frontend access password**: Adds a lightweight access gate for public deployments.

## Workflow

1. In **Friends**, create AI friends and bind a model to each; in **Settings**, enter the provider / Base URL / API key.
2. Back in the workspace, select the friends for this round, type your prompt (optionally attach images), and send.
3. Models stream their answers in parallel. You can **Stop** at any time, **Regenerate** a single answer, or **Edit & resend** your own message.
4. When you want a conclusion, click **Synthesize** to have the synthesis expert merge the round's answer text into a combined result.
5. To go deeper, enable **Expert-only chat** and keep asking the expert, building on the existing synthesis.

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
| Settings | `settings.html` | Runtime mode, CORS proxy, theme, font size, and model configuration |
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

Visit: `http://127.0.0.1:9090`

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

OpenChat has two deployment shapes, one for each runtime mode. The frontend is built with Vite, so **you must run `npm run build` to generate `dist/` before deploying** (the raw source is not browser-runnable).

### Shape A: Frontend / static deployment (recommended)

For **Frontend mode**: API keys live in the browser, which calls model APIs directly. After building, deploy `dist/` to any static host (Vercel, Cloudflare Pages, Nginx, GitHub Pages, etc.).

```bash
npm run build   # output in dist/
```

#### Deploy to Vercel

Vercel is a good fit for **Frontend mode** (pure static). OpenChat's Node backend is a self-hosted HTTP server and is not compatible with Vercel's serverless model, so use frontend mode on Vercel.

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

### Shape B: Self-hosted with the Node backend

For **Backend mode**: the Node server (`server.mjs`) provides the `/api/*` routes and persists data to `.data/openchat-db.json`. The frontend calls the backend via **same-origin** `/api/*`, so the static frontend and the API must share one origin — a reverse proxy is recommended.

1. Build the frontend:

   ```bash
   npm run build
   ```

2. Start the backend (API + persistence, port 8787 by default, override with `PORT`):

   ```bash
   PORT=8787 npm run start
   ```

3. Use Nginx / Caddy to serve static `dist/` and proxy `/api/*` under one HTTPS domain:

   ```nginx
   server {
     listen 443 ssl;
     server_name your.domain;
     # ssl_certificate ...;  ssl_certificate_key ...;

     root /path/to/OpenChat/dist;
     index index.html;

     location /api/ {
       proxy_pass http://127.0.0.1:8787;
       proxy_set_header Host $host;
     }
     location / {
       try_files $uri $uri/ /index.html;
     }
   }
   ```

4. Open the site, go to `settings.html`, and switch the runtime mode to **Backend**.
5. Keep the backend alive with pm2 / systemd, and back up the `.data/` directory regularly:

   ```bash
   npm i -g pm2
   pm2 start "npm run start" --name openchat
   pm2 save
   ```

> All backend data lives in `.data/openchat-db.json`; copy the whole `.data/` directory to back up or migrate.

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
