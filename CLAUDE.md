# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working Style

- Act directly when a safe, reasonable default exists instead of asking the user for permission for routine work.
- Until the project is genuinely usable, keep updating the code toward a working state instead of stopping after partial progress.
- Prefer minimal, repo-aligned changes over broad rewrites.
- Verify relevant tests or build commands before claiming work is complete.

## Commands

```bash
npm install          # install dependencies
npm run dev          # Vite multi-page frontend dev server (port 4173)
npm run dev:server   # Node backend server (port 8787)
npm run start        # same backend entrypoint as dev:server
npm run build        # build frontend to dist/
npm run preview      # preview built frontend locally
npm test             # full Node test suite
```

Single test file:

```bash
node --test frontend-auth.test.mjs
```

Filter by test name:

```bash
node --test --test-name-pattern="frontend password" frontend-auth.test.mjs
```

Multiple specific test files:

```bash
node --test frontend-auth.test.mjs synthesis-utils.test.mjs
```

Current `npm test` runs the repo-root test files plus the focused `features/group/*.test.mjs` suite listed in `package.json`.

There is currently no dedicated lint or formatting script in `package.json`; do not assume ESLint, Prettier, or TypeScript are configured.

## Architecture

OpenChat is a multi-model AI workspace with two runtime modes:

- **Frontend mode**: browser-only, state stored in `localStorage`, provider calls made directly from the browser.
- **Backend mode**: Node.js server at `http://127.0.0.1:8787`, persists data to `.data/openchat-db.json`, and proxies model API calls server-side.

This is a **Vite multi-page app**, not a SPA. The main pages are `index.html`, `settings.html`, `friends.html`, `auth.html`, and `history.html`.

All of those pages share the same frontend controller in `script.js`. Page-specific behavior is mostly gated by which DOM elements exist on the current page, so changes in `script.js` can easily affect multiple screens.

### Core files

| File | Role |
|------|------|
| `script.js` | Main frontend controller for all pages. Contains i18n strings, storage keys, runtime-mode switching, DOM wiring, API calls, and chat/history workflows. |
| `server.mjs` | Self-contained Node HTTP server. Serves static files, handles `/api/*`, persists backend data, contains provider adapters, and streams chat responses. |
| `styles.css` | Shared styles for the whole app. |
| `vite.config.js` | Vite config with explicit multi-page HTML inputs. |
| `account-scope-utils.mjs` | Normalizes local account identity and builds scoped storage keys for frontend data. |
| `frontend-auth-utils.mjs` | Frontend password-gate helpers and local model bootstrap helpers. |
| `synthesis-utils.mjs` | Shared synthesis payload and fallback prompt builders. |
| `features/group/*.mjs` | Extracted group workflow utilities with dedicated tests; prefer extending this area for testable group logic instead of adding more branching to `script.js`. |
| `ai-message-streamdown.jsx` | React-based markdown rendering island used for message display; the overall frontend architecture is still plain multi-page JavaScript, not a React app. |

### Backend API routes

```
GET  /api/account
POST /api/auth/register
GET  /api/models
POST /api/models
POST /api/models/test
GET  /api/friends
POST /api/friends
GET  /api/group-settings
POST /api/group-settings
GET  /api/conversations
POST /api/conversations
POST /api/chat/run
POST /api/chat/run/stream
```

### Provider adapters (`server.mjs`)

Three adapters are implemented:
- `callOpenAICompatible` — used for OpenAI, xAI, and custom OpenAI-compatible endpoints
- `callAnthropic` — used for Anthropic's messages API format
- `callGemini` — used for Google Gemini's endpoint/schema

Provider selection is based on each model config's `baseUrl`.

## Data And Runtime Notes

- Frontend state is not stored under one global keyset; key data is scoped by account/workspace using `buildScopedStorageKey(...)` from `account-scope-utils.mjs`.
- Backend persistence lives in `.data/openchat-db.json`.
- `public/openchat.local-models.json` is only a local bootstrap source for first use in `frontend` mode when no model config already exists in `localStorage`; it should remain an empty placeholder in the repo unless explicitly preparing a local-only setup.
- `public/frontend-auth.json` configures the frontend-only password gate. It affects `frontend` mode, not backend auth.
- For OpenAI-compatible gateways, prefer a full API base URL, usually ending in `/v1`.

### Data model (`.data/openchat-db.json`)

```json
{
  "account": null | { email, workspace },
  "models": [ { id, name, provider, model, baseUrl, apiKey, enabled } ],
  "friends": [ { id, name, avatar, modelConfigId, systemPrompt, enabled, description } ],
  "groupSettings": { memberIds, sharedSystemPromptEnabled, sharedSystemPrompt, platformFeatureEnabled, preferredPlatform, synthesisFriendId },
  "conversations": [ { id, prompt, messages, responses, mergedAnswer, disagreements } ]
}
```

Conversation history is capped at 50 entries.

### Streaming

`POST /api/chat/run/stream` returns newline-delimited JSON (`application/x-ndjson`), not SSE. Preserve that contract if you touch frontend streaming or backend response generation.

### Internationalisation

`script.js` contains a top-level `I18N` object with `zh-CN` and `en` keys. The active language is persisted in `localStorage` under `multiplechat-language`. Default is `zh-CN`.

## Search And Editing Boundaries

When searching or reviewing results, ignore generated or duplicate-worktree directories unless the task explicitly targets them:

- `node_modules/`
- `dist/`
- `.data/`
- `.worktrees/`
- `.claude/worktrees/`
- `.playwright/`
- `.playwright-cli/`

The worktree directories can contain near-duplicate copies of the repo and easily produce misleading search results.

## Code Style

- Use native ESM only; prefer `node:` imports for Node built-ins.
- Use double quotes and semicolons.
- Prefer 2-space indentation and preserve local wrapping style in touched files.
- Use `camelCase` for functions and variables, `UPPER_SNAKE_CASE` for top-level constants.
- Prefer small normalization helpers and early returns over deeply nested branches.
- Keep JSON shapes stable across frontend and backend because shared data contracts are used throughout the app.
- In backend handlers, return structured JSON errors or fallbacks instead of uncaught exceptions.
- When adding logic that can be tested in isolation, prefer extracting a small utility module with a matching `*.test.mjs` file.
