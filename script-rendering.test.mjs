import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function loadRenderingHelpers() {
  const source = readFileSync(new URL("./script.js", import.meta.url), "utf8");
  const start = source.indexOf("function escapeHtml(value = \"\") {");
  const end = source.indexOf("\nfunction sleep(ms) {", start);

  assert.notEqual(start, -1, "expected escapeHtml helper block in script.js");
  assert.notEqual(end, -1, "expected helper block boundary before sleep() in script.js");

  const helperBlock = source.slice(start, end);
  const helperFactory = new Function(
    `${helperBlock}
return { escapeHtml, encodeMessageField, renderAssistantMessageContent };`
  );

  return helperFactory();
}

const { renderAssistantMessageContent } = loadRenderingHelpers();

function buildLoadingBody() {
  return '<div class="ai-card-body loading">Loading</div>';
}

test("renders assistant content with a streamdown mount target", () => {
  const html = renderAssistantMessageContent({
    content: "# Final answer\n\nUse **bold** insight.",
    isLoading: false,
    kind: "assistant",
    messageId: "msg-1",
    loadingBody: buildLoadingBody()
  });

  assert.match(html, /class="ai-card-body markdown-content streamdown-target"/);
  assert.match(html, /data-message-id="msg-1"/);
  assert.match(html, /data-field="content"/);
  assert.match(html, /data-kind="assistant"/);
  assert.match(html, /data-content="# Final answer\n\nUse \*\*bold\*\* insight\."/);
  assert.doesNotMatch(html, /<h1>Final answer<\/h1>/);
});


test("renders synthesis assistant content with a streamdown mount target", () => {
  const html = renderAssistantMessageContent({
    content: "# Final answer <script>alert(1)</script> **bold**",
    isLoading: false,
    kind: "synthesis",
    messageId: "msg-2",
    loadingBody: buildLoadingBody()
  });

  assert.match(html, /class="ai-card-body markdown-content streamdown-target"/);
  assert.match(html, /data-message-id="msg-2"/);
  assert.match(html, /data-field="content"/);
  assert.match(html, /data-kind="synthesis"/);
  assert.match(html, /data-content="# Final answer &lt;script&gt;alert\(1\)&lt;\/script&gt; \*\*bold\*\*"/);
});
