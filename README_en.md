# OpenChat

[中文](./README.md)

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

Create or edit `public/frontend-auth.json`:

```json
{
  "frontendPasswordMd5": "<md5-hash>"
}
```

Generate an MD5 hash with Node:

```bash
node -e "console.log(require('crypto').createHash('md5').update('your-password').digest('hex'))"
```

**Do not commit a real password hash that you actively use.**

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
node --test src/__tests__/frontend-auth.test.mjs
```

Run tests by name:

```bash
node --test --test-name-pattern="frontend password" src/__tests__/frontend-auth.test.mjs
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

- `src/script.js` - frontend app logic, i18n, rendering, runtime switching, state sync
- `src/styles.css` - all application styling
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

- Automated tests use the Node built-in test runner and live in `src/__tests__/` directory
- The backend currently uses JSON-file persistence for a lightweight MVP
- The backend includes adapters for OpenAI-compatible APIs, Anthropic, and Gemini
- In `backend` mode, history edits sync back to the server through `POST /api/conversations`
- If backend loading fails, the UI falls back to `frontend` mode so local state remains usable
- `vendor/ai-search-hub` can be vendored as an optional backend bridge for AI Search Hub
- To enable real platform execution, install Python Playwright in the local `py` environment and ensure the target platform site is reachable and logged in