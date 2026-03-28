# AGENTS.md

This file is for agentic coding tools working in `D:\ghproject\openchat`.

## Operating Principles

- Act directly when a safe, reasonable default exists; do not stop to ask the user for permission for routine work.
- Ask only when blocked by ambiguity that materially changes the result, or when the action is destructive, security-sensitive, or needs a secret.
- Until the project is genuinely usable, keep updating the code toward a working state instead of stopping after partial progress.
- Prefer reading the repository and following existing patterns over inventing new abstractions.
- Keep changes focused on the requested task; do not perform unrelated refactors.
- Never revert user changes you did not make.
- Before claiming success, run the relevant verification command and report the actual result.

## Repository Snapshot

- App name: `OpenChat`
- Stack: browser-side JavaScript, Node.js HTTP server, Vite for frontend dev/build
- Module system: native ESM (`"type": "module"`)
- Main frontend logic: `script.js`
- Main backend logic: `server.mjs`
- Styling: `styles.css`
- Main pages: `index.html`, `settings.html`, `friends.html`, `auth.html`, `history.html`
- Backend persistence: `.data/openchat-db.json`
- Tests: Node built-in test runner with `*.test.mjs` files in repo root

## Commands

### Setup

```bash
npm install
```

### Development

```bash
npm run dev
npm run dev:server
npm run start
```

- `npm run dev` starts the Vite frontend dev server on port `4173`
- `npm run dev:server` starts the Node backend on port `8787`
- `npm run start` is the same backend entrypoint as `dev:server`

### Build

```bash
npm run build
npm run preview
```

- `npm run build` outputs the frontend build to `dist/`
- `npm run preview` serves the built frontend locally

### Tests

Run the full test suite:

```bash
npm test
```

Current `npm test` expands to:

```bash
node --test frontend-auth.test.mjs mock-response-utils.test.mjs frontend-provider-utils.test.mjs model-test-utils.test.mjs synthesis-utils.test.mjs account-scope-utils.test.mjs friend-bootstrap-utils.test.mjs thinking-config-utils.test.mjs
```

Run a single test file:

```bash
node --test frontend-auth.test.mjs
```

Run multiple specific test files:

```bash
node --test frontend-auth.test.mjs synthesis-utils.test.mjs
```

Useful Node test runner options:

```bash
node --test --test-name-pattern="frontend password" frontend-auth.test.mjs
node --test --watch frontend-auth.test.mjs
```

### Lint / Formatting

- No dedicated lint script is currently configured in `package.json`
- No dedicated formatter config was found in the repository root
- Do not assume ESLint, Prettier, or TypeScript are installed
- Match the formatting and structure already used in the touched file

## Rule Files

- Existing `AGENTS.md`: none found before this file was created
- Cursor rules in `.cursor/rules/`: none found
- `.cursorrules`: not present
- Copilot instructions in `.github/copilot-instructions.md`: not present

If these files are added later, treat them as additional repository instructions and update this file when needed.

## Architecture Notes

- The project supports two runtime modes:
- `frontend` mode stores state in `localStorage` and talks to providers directly from the browser
- `backend` mode uses `server.mjs` for `/api/*` routes and JSON-file persistence
- `server.mjs` is intentionally self-contained and handles routing, persistence, provider calls, and some fallback behavior
- `script.js` is large and central; follow existing local helper patterns before splitting files
- Several utility modules exist in repo root, such as `frontend-auth-utils.mjs`, `synthesis-utils.mjs`, and `thinking-config-utils.mjs`

## Code Style

### Imports and Modules

- Use ESM `import` / `export` syntax only
- Prefer grouped imports at the top of the file
- Use Node built-ins with the `node:` prefix, for example `import test from "node:test"`
- Use relative imports for local modules, usually with explicit `.mjs` or `.js` extensions
- Keep import ordering stable and readable; existing code generally puts built-ins before local imports

### Formatting

- Use double quotes, not single quotes
- Use semicolons
- Prefer 2-space indentation
- Keep trailing commas consistent with the surrounding file; many files omit them in short literals and use them only when multiline structure benefits readability
- Preserve existing line wrapping style instead of reformatting unrelated code
- Keep blank lines purposeful: separate imports, top-level constants, and distinct helper groups

### Naming

- Use `camelCase` for variables, functions, and object properties
- Use `UPPER_SNAKE_CASE` for top-level constants with global meaning, such as `DATA_FILE`, `PORT`, and `STORAGE_KEYS`
- Use descriptive helper names like `normalizeBaseUrl`, `buildFallbackSynthesis`, `hasUnlockedFrontendAccess`
- Prefer verbs for functions and predicates for booleans: `build*`, `create*`, `normalize*`, `detect*`, `has*`, `should*`
- Keep exported utility names explicit rather than clever or abbreviated

### Types and Data Shape Discipline

- The repo does not use TypeScript; enforce shape consistency through careful object construction and normalization helpers
- When accepting optional input, default parameters to safe values, often empty strings, arrays, or objects
- Normalize external or persisted data before using it
- When returning structured objects, keep key names stable because frontend and backend code share data contracts
- Preserve existing JSON shapes for `account`, `models`, `friends`, `groupSettings`, and `conversations`

### Functions and Control Flow

- Prefer small helper functions for normalization, payload building, and guards
- Keep branching straightforward and explicit
- Prefer early returns for invalid or empty inputs when that matches surrounding code
- Use `async` / `await` instead of raw promise chains in most new code
- When adding shared logic, consider a small utility module if it improves testability and matches existing patterns

### Error Handling

- Handle recoverable failures explicitly and return a stable fallback when the app already does so
- In backend request handlers, send structured JSON responses instead of throwing unhandled errors to the client
- Preserve user-facing resilience: this app often falls back to mock or local behavior instead of hard-failing
- When reading persisted or remote data, validate shape assumptions before use
- Avoid swallowing errors silently unless the surrounding code intentionally treats absence as normal

### Testing Style

- Use the built-in Node test runner: `import test from "node:test"`
- Use strict assertions: `import assert from "node:assert/strict"`
- Keep test files near repo root following the existing `*.test.mjs` pattern
- Write descriptive test names in plain English
- Prefer pure utility extraction for logic that needs reliable tests
- When changing behavior in a utility module, add or update targeted tests in the corresponding `*.test.mjs` file

### HTML / CSS / Frontend

- Preserve the existing multi-page structure rather than introducing a framework
- Keep DOM hooks, state keys, and i18n usage consistent with `script.js`
- Reuse existing `STORAGE_KEYS`, `I18N`, and helper functions instead of duplicating constants
- Keep CSS in `styles.css` unless there is a strong existing reason to do otherwise
- Preserve mobile usability and avoid breaking either frontend mode or backend mode

## Change Strategy for Agents

- Read the touched file before editing it
- Prefer minimal edits over broad rewrites
- Follow the local style of the specific file, even if another file uses a slightly different pattern
- Add comments only when a non-obvious block truly needs explanation
- Do not add new dependencies unless the task clearly requires them
- Do not invent a linting or formatting stack unless asked

## Verification Expectations

- For code changes, run the most relevant tests for the touched area
- If the change affects shared frontend or backend behavior, prefer `npm test`
- If the change affects the shipped frontend bundle, also run `npm run build`
- Do not claim tests or build pass without actually running them
- Report failures clearly and include the next most useful fix direction

## Practical Defaults

- Safe default: act and verify instead of asking the user what command to run
- Safe default: prefer existing architecture over new abstractions
- Safe default: preserve compatibility with both runtime modes unless the task explicitly targets one mode
- Safe default: keep secrets out of the repo and out of commits
- Safe default: if there is a choice between a tiny targeted utility and more branching in a large file, choose the option that best matches current repository patterns
