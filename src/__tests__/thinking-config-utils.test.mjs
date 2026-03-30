import test from "node:test";
import assert from "node:assert/strict";

import { hasThinkingContent, normalizeThinkingEnabled } from "../utils/thinking-config-utils.mjs";

test("normalizeThinkingEnabled preserves explicit boolean values", () => {
  assert.equal(normalizeThinkingEnabled(true, false), true);
  assert.equal(normalizeThinkingEnabled(false, true), false);
});

test("normalizeThinkingEnabled falls back when value is missing", () => {
  assert.equal(normalizeThinkingEnabled(undefined, true), true);
  assert.equal(normalizeThinkingEnabled(undefined, false), false);
});

test("hasThinkingContent only returns true for non-empty reasoning text", () => {
  assert.equal(hasThinkingContent({ thinking: "step 1\nstep 2" }), true);
  assert.equal(hasThinkingContent({ thinking: "   " }), false);
  assert.equal(hasThinkingContent({}), false);
});
