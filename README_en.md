# OpenChat

[中文](./README.md)

OpenChat is an open-source multi-model AI group chat workspace. Send the same message to multiple AI friends simultaneously, compare their answers side by side in a unified interface, and let an AI integration expert generate a synthesized reply.

## Features

- **Multi-Model Group Chat** — Send one message to multiple AI friends at once with real-time streaming responses
- **AI Integration Expert** — Designate a friend as the integration expert to automatically synthesize all responses into a unified conclusion
- **Expert-Only Mode** — Skip regular friends and chat directly with the integration expert, with full multi-turn context support
- **Markdown Rendering** — Real-time Streamdown-based Markdown with code highlighting, math formulas, Mermaid diagrams, and CJK optimization
- **Reasoning Collapse** — Auto-detects `<think>` tags and `reasoning_content`, expands during streaming and collapses on completion
- **Copy Button** — One-click copy on all friend messages after generation completes
- **Multi-Turn Conversations** — Each friend maintains independent conversation history for follow-up questions
- **Group Management** — Freely choose which friends participate in each conversation, with shared system prompts
- **Conversation History** — Save, rename, pin, share, and delete past conversations
- **Bilingual UI** — Chinese / English toggle
- **Dual Runtime Modes** — Pure frontend mode (localStorage) or backend mode (Node.js server persistence)
- **Password Gate** — Optional MD5 password protection for public deployments
- **Mock Fallback** — Auto-uses simulated responses when API keys are not configured, keeping the UI functional

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS + React 19 (hybrid rendering) |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui + AI Elements |
| State | Zustand |
| Build | Vite |
| Backend | Node.js (native HTTP, no framework) |
| AI SDK | Vercel AI SDK |
| Markdown | Streamdown (streaming renderer) |
| Testing | Node built-in test runner |

## Getting Started

### Install Dependencies

```bash
npm install
```

### Frontend Development

```bash
npm run dev
```

Open `http://127.0.0.1:4173` in your browser.

### Backend Development

```bash
npm run dev:server
```

Open `http://127.0.0.1:8787` in your browser.

### Build

```bash
npm run build
npm run preview
```

### Run Tests

```bash
# Full test suite
npm test

# Single test file
node --test src/__tests__/frontend-auth.test.mjs

# Filter by name
node --test --test-name-pattern="frontend password" src/__tests__/frontend-auth.test.mjs
```

## Pages

| Page | Path | Description |
|------|------|-------------|
| Main Workspace | `index.html` | Multi-friend chat UI, message sending, synthesis replies |
| Model Settings | `settings.html` | Model providers, API keys, base URLs, runtime mode |
| Friend Management | `friends.html` | Add/edit AI friends, bind models, set system prompts |
| Account Registration | `auth.html` | Local account registration |
| Conversation History | `history.html` | Browse and manage saved conversations |

## Architecture

### Runtime Modes

**Frontend Mode**

- Runs entirely in the browser, all state in `localStorage`
- API requests go directly from the browser to each model provider
- Suitable for personal use or static deployments

**Backend Mode**

- Node.js server provides `/api/*` routes and static file serving
- Data persisted to `.data/openchat-db.json`
- Responses streamed via NDJSON
- API keys managed server-side for better security

### Core Files

| File | Role |
|------|------|
| `src/script.js` | Frontend main logic: i18n, rendering, state management, runtime switching |
| `src/styles.css` | All styles |
| `server.mjs` | Node HTTP server, API routes, provider adapters |
| `vite.config.js` | Vite build configuration |
| `src/stores/chatStore.ts` | Zustand state management (React layer) |
| `src/chat-main.tsx` | React chat component mount entry |
| `src/components/chat/` | React chat components (FriendChatCard, SynthesisCard, etc.) |
| `src/components/ai-elements/` | AI Elements components (Message, Reasoning, PromptInput, etc.) |

### Provider Adapters

The backend includes three built-in API adapters:

| Adapter | Providers |
|---------|-----------|
| `callOpenAICompatible` | OpenAI, xAI, Kimi, DeepSeek, and all OpenAI-compatible endpoints |
| `callAnthropic` | Anthropic Claude |
| `callGemini` | Google Gemini |

Frontend mode also supports direct calls to these providers, with streaming for OpenAI-compatible endpoints.

## Backend API

```
GET  /api/account              # Get account info
POST /api/auth/register         # Register account
GET  /api/models                # Get model configs
POST /api/models                # Save model configs
GET  /api/friends               # Get friend list
POST /api/friends               # Save friend list
GET  /api/group-settings        # Get group settings
POST /api/group-settings        # Save group settings
GET  /api/conversations         # Get conversation history
POST /api/conversations         # Save conversation history
POST /api/chat/run              # Non-streaming run
POST /api/chat/run/stream       # Streaming run (NDJSON)
```

## Data Storage

Backend data file: `.data/openchat-db.json`

```json
{
  "account": null,
  "models": [],
  "friends": [],
  "groupSettings": {},
  "conversations": []
}
```

Conversation history is capped at 50 entries.

## Configuration

### Password Gate

Frontend mode supports optional password protection. Configuration priority:

1. `VITE_FRONTEND_PASSWORD_MD5` environment variable
2. `public/frontend-auth.json`

```json
{
  "frontendPasswordMd5": "<md5-hash>"
}
```

Generate an MD5 hash:

```bash
node -e "console.log(require('crypto').createHash('md5').update('your-password').digest('hex'))"
```

### Local Model Bootstrap

On first use in frontend mode, if no model configs exist in `localStorage`, the app auto-loads `public/openchat.local-models.json`.

- This file is for local bootstrap and demo setup only
- Keep the repository copy as an empty placeholder (`{"models":[]}`); do not commit real API keys
- Existing browser model configs are not overwritten
- For OpenAI-compatible gateways, the base URL typically ends with `/v1`

## Deployment

### Static Frontend

For Vercel, Cloudflare Pages, etc.:

```bash
npm run build
# Output directory: dist
```

### Backend

```bash
node server.mjs
# Default port: 8787
```

Serve frontend and backend from the same origin to use `/api/*` routes without extra proxy configuration.

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

> **Note:** These settings only apply to the current site and do not affect the security policy of other websites. Each browser must be configured separately.

## Notes

- Test files live in `src/__tests/` and `features/`, using the Node built-in test runner
- Backend uses JSON file persistence, suitable for lightweight scenarios
- History edits in backend mode sync back to the server via `POST /api/conversations`
- If backend loading fails, the UI falls back to frontend mode to keep local state usable
- `vendor/ai-search-hub` can be vendored as an optional backend bridge for AI Search Hub
- Platform execution features require local Python Playwright installation and accessible target sites

## License

MIT
