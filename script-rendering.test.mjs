import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { renderSafeMarkdown } from "./markdown-render-utils.mjs";

function loadRenderingHelpers() {
  const source = readFileSync(new URL("./script.js", import.meta.url), "utf8");
  const start = source.indexOf("function escapeHtml(value = \"\") {");
  const end = source.indexOf("\nfunction sleep(ms) {", start);

  assert.notEqual(start, -1, "expected escapeHtml helper block in script.js");
  assert.notEqual(end, -1, "expected helper block boundary before sleep() in script.js");

  const helperBlock = source.slice(start, end);
  const helperFactory = new Function(
    "renderSafeMarkdown",
    `${helperBlock}
return { escapeHtml, renderSynthesisContent, renderAssistantMessageContent };`
  );

  return helperFactory(renderSafeMarkdown);
}

const { renderAssistantMessageContent } = loadRenderingHelpers();

function buildLoadingBody() {
  return '<div class="ai-card-body loading">Loading</div>';
}

test("renders synthesis assistant content with markdown output", () => {
  const html = renderAssistantMessageContent({
    content: "# Final answer\n\nUse **bold** insight.",
    isLoading: false,
    kind: "synthesis",
    loadingBody: buildLoadingBody()
  });

  assert.match(html, /class="ai-card-body markdown-content"/);
  assert.match(html, /<h1>Final answer<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
});

test("renders non-synthesis assistant content as escaped plain text", () => {
  const html = renderAssistantMessageContent({
    content: "# Final answer <script>alert(1)</script> **bold**",
    isLoading: false,
    kind: "assistant",
    loadingBody: buildLoadingBody()
  });

  assert.doesNotMatch(html, /markdown-content/);
  assert.match(html, /class="ai-card-body"/);
  assert.match(html, /# Final answer &lt;script&gt;alert\(1\)&lt;\/script&gt; \*\*bold\*\*/);
  assert.doesNotMatch(html, /<strong>bold<\/strong>/);
});
