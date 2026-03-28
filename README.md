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
