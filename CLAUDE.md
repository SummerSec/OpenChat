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
npm run dev          # Vite dev server (frontend only, port 4173)
npm run dev:server   # Node backend server (port 8787)
npm test             # full Node test suite
npm run build        # build to dist/
npm run preview      # preview built output
npm run start        # same as dev:server
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

## Architecture

OpenChat is a multi-model AI workspace with two runtime modes:

- **Frontend mode**: browser-only, all state in localStorage, API calls made directly from the browser to each model provider.
- **Backend mode**: Node.js server at `http://127.0.0.1:8787`, persists data to `.data/openchat-db.json`, proxies all model API calls server-side.

### Core files

| File | Role |
|------|------|
| `server.mjs` | Self-contained Node HTTP server (no framework). Handles `/api/*` routes and serves static files. Contains provider adapters and mock response logic. |
| `script.js` | All frontend logic. Shared by all pages. Contains i18n strings, `DEFAULT_MODELS`, `STORAGE_KEYS`, and runtime-mode switching. |
| `styles.css` | All styles. |
| `vite.config.js` | Vite config (dev/preview on port 4173). |
| `frontend-auth-utils.mjs` | Frontend password gating and local model bootstrap helpers. |
| `synthesis-utils.mjs` | Shared synthesis payload and fallback prompt builders. |

### Additional pages

- `friends.html` — AI friend management and group member setup
- `history.html` — saved conversation history browser
- `auth.html` — local account registration

### Pages

- `index.html` — main workspace (send prompt, compare responses, synthesize)
- `settings.html` — per-model config (provider, model ID, base URL, API key)
- `friends.html` — manage AI friends, model bindings, and friend prompts
- `history.html` — conversation history browser
- `auth.html` — account registration

### Backend API routes

```
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

### Provider adapters (server.mjs)

Three adapters are implemented:
- `callOpenAICompatible` — used for OpenAI, xAI, and any custom OpenAI-compatible endpoint
- `callAnthropic` — used for Anthropic (different messages API format)
- `callGemini` — used for Google Gemini (different endpoint and schema)

Provider selection is based on the `baseUrl` of each model config.

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

### Internationalisation

`script.js` contains a top-level `I18N` object with `zh-CN` and `en` keys. The active language is persisted in localStorage under `multiplechat-language`. Default is `zh-CN`.

## Code Style

- Use native ESM only; prefer `node:` imports for Node built-ins.
- Use double quotes and semicolons.
- Prefer 2-space indentation and preserve local wrapping style in touched files.
- Use `camelCase` for functions and variables, `UPPER_SNAKE_CASE` for top-level constants.
- Prefer small normalization helpers and early returns over deeply nested branches.
- Keep JSON shapes stable across frontend and backend because shared data contracts are used throughout the app.
- In backend handlers, return structured JSON errors or fallbacks instead of uncaught exceptions.
- When adding logic that can be tested in isolation, prefer extracting a small utility module with a matching `*.test.mjs` file.
