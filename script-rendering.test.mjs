import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SCRIPT_PATH = new URL("./script.js", import.meta.url);

async function readScript() {
  return readFile(SCRIPT_PATH, "utf8");
}

test("script imports markdown renderer and adds guarded synthesis helper", async () => {
  const script = await readScript();

  assert.match(script, /import\s*\{\s*renderSafeMarkdown\s*\}\s*from\s*"\.\/markdown-render-utils\.mjs";/);
  assert.match(script, /function renderSynthesisContent\(content = ""\) \{/);
  assert.match(script, /return `<div class="ai-card-body markdown-content">\$\{renderSafeMarkdown\(content \|\| ""\)\}<\/div>`;/);
  assert.match(script, /catch \{\s*return `<div class="ai-card-body">\$\{escapeHtml\(content \|\| ""\)\}<\/div>`;/s);
});

test("script only uses markdown rendering for synthesis messages", async () => {
  const script = await readScript();

  assert.match(
    script,
    /const contentBody =\s*item\.content \|\| !item\.isLoading\s*\? item\.kind === "synthesis"\s*\? renderSynthesisContent\(item\.content \|\| ""\)\s*:\s*`<div class="ai-card-body">\$\{escapeHtml\(item\.content \|\| ""\)\}<\/div>`\s*:\s*loadingBody;/s
  );
});
