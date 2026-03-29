# OpenChat

OpenChat is a multi-model AI workspace for running the same prompt through multiple model personas, comparing their answers, and generating one synthesis reply inside a shared chat UI.

It supports two runtime modes:

- `frontend` mode: browser-only, all state stored in `localStorage`
- `backend` mode: Node.js server persistence, same UI, server-hosted `/api/*` routes

## What The App Does

- Run one prompt across multiple AI friends in the same conversation
- Bind each friend to a model config, avatar, and personal system prompt
- Select which friends join a conversation
- Pick a synthesis friend for the final merged answer
- Apply a shared system prompt to the whole group for the current conversation
- Stream responses from the backend with incremental updates
- Save, rename, pin, share, and delete conversation history
- Switch between Chinese and English
- Use either browser-local persistence or backend JSON persistence

## Pages

- `index.html` - main workspace and multi-friend chat
- `settings.html` - model routing, provider settings, runtime mode
- `friends.html` - AI friend management
- `auth.html` - local account registration surface
- `history.html` - stored conversation history

## Run

Install dependencies:

```bash
npm install
```

Frontend-only development:

```bash
npm run dev
```

Backend server:

```bash
npm run start
```

You can also run the backend in development mode:

```bash
npm run dev:server
```

Default ports:

- Vite frontend: `http://127.0.0.1:4173`
- Node backend: `http://127.0.0.1:8787`

## Frontend Password Gate

Frontend mode can require a global password check before any page becomes usable.

- Passwords are compared by `MD5`
- The unlocked state is stored in `localStorage`, so it remains valid long-term in the same browser
- Backend mode is not gated by this frontend-only password layer

Configuration priority:

1. `VITE_FRONTEND_PASSWORD_MD5` environment variable
2. `public/frontend-auth.json`

### Vercel or other hosted frontend builds

Set:

```bash
VITE_FRONTEND_PASSWORD_MD5=<your-md5-hash>
```

### Local deployment

Edit:

`public/frontend-auth.json`

Example:

```json
{
  "frontendPasswordMd5": "5f4dcc3b5aa765d61d8327deb882cf99"
}
```

You can generate an MD5 hash with Node:

```bash
node -e "console.log(require('crypto').createHash('md5').update('your-password').digest('hex'))"
```

## Local Model Bootstrap

Frontend mode now auto-loads `public/openchat.local-models.json` on first use when the browser does not already have model configs in `localStorage`.

- This is intended for local bootstrap and demo setup
- Existing saved model configs in the browser are not overwritten
- To re-apply the file, clear the saved model config key from `localStorage`

Current local bootstrap file:

- `public/openchat.local-models.json`

For OpenAI-compatible gateways, prefer the full API base path, usually ending in `/v1`.

## Build

```bash
npm run build
npm run preview
```

## Architecture

### Frontend mode

- Keeps account, models, friends, group settings, and history in `localStorage`
- Can use mock responses when no live endpoint is configured
- Uses the same pages and interaction model as backend mode

### Backend mode

- Serves static files and `/api/*` routes from `server.mjs`
- Persists data to `.data/openchat-db.json`
- Streams run output through newline-delimited JSON
- Stores account, models, friends, default group settings, and conversations on the server

### Core files

- `script.js` - frontend app logic, i18n, rendering, runtime switching, state sync
- `styles.css` - all application styling
- `server.mjs` - self-contained Node HTTP server and provider adapters
- `vite.config.js` - Vite configuration

## Backend API

The included backend currently exposes:

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

## Data Storage

Backend persistence lives in:

- `.data/openchat-db.json`

The stored shape includes:

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

## Model Execution

The backend includes adapters for:

- OpenAI-compatible APIs
- Anthropic
- Gemini

When a provider is not fully configured, the app can fall back to mock responses so the UI remains usable during setup.

## Current UX Notes

- The workspace supports renaming, pinning, sharing, deleting, and clearing history
- In backend mode, history edits now sync back to the server through `POST /api/conversations`
- If backend loading fails, the UI falls back to frontend mode and keeps local state usable
- AI Search Hub can be vendored under `vendor/ai-search-hub` and used as an optional backend bridge for platform-aware runs
- To enable real platform execution, install Python Playwright in the local environment used by `py` and ensure the target platform site can be opened and logged in

## Deploy

Static frontend output:

- Vercel: build with `npm run build`, output `dist`
- Cloudflare Pages: build with `npm run build`, output `dist`

Node backend:

- Run `node server.mjs`
- Serve the frontend and backend from the same origin if you want `/api/*` routes available without extra proxy setup

## Notes

- No automated test suite is configured yet
- The backend uses JSON-file persistence for a lightweight MVP
- A natural next step is replacing file storage with a database and hardening auth and provider secret handling
