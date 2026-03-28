import test from "node:test";
import assert from "node:assert/strict";

import { renderAssistantMessageContent } from "./script-rendering-utils.mjs";

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
