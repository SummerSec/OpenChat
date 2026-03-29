import test from "node:test";
import assert from "node:assert/strict";

import { detectProviderKind, hasLiveProviderConfig } from "./frontend-provider-utils.mjs";

test("hasLiveProviderConfig requires baseUrl and apiKey", () => {
  assert.equal(hasLiveProviderConfig({ baseUrl: "https://api.example.com/v1", apiKey: "sk-test" }), true);
  assert.equal(hasLiveProviderConfig({ baseUrl: "https://api.example.com/v1", apiKey: "" }), false);
  assert.equal(hasLiveProviderConfig({ baseUrl: "", apiKey: "sk-test" }), false);
});

test("detectProviderKind identifies anthropic models", () => {
  assert.equal(detectProviderKind({ provider: "Anthropic", name: "Claude" }), "anthropic");
});

test("detectProviderKind identifies gemini models", () => {
  assert.equal(detectProviderKind({ provider: "Google", name: "Gemini" }), "gemini");
});

test("detectProviderKind defaults to openai-compatible", () => {
  assert.equal(detectProviderKind({ provider: "OpenAI", name: "GPT-5.3 Codex" }), "openai-compatible");
  assert.equal(detectProviderKind({ provider: "Custom", name: "SuperCodex" }), "openai-compatible");
});
