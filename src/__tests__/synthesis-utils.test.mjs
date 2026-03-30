import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFallbackSynthesis,
  buildSynthesisPayload,
  buildSynthesisPromptText
} from "../utils/synthesis-utils.mjs";

test("buildSynthesisPayload includes user prompt and member outputs", () => {
  const payload = buildSynthesisPayload({
    prompt: "你是谁？",
    language: "zh-CN",
    results: [
      {
        name: "GPT-5.3 Codex",
        model: "gpt-5.3-codex",
        provider: "daijulive",
        content: "我是一个 AI 助手。",
        source: "已配置"
      }
    ]
  });

  assert.equal(payload.user_prompt, "你是谁？");
  assert.equal(payload.member_outputs.length, 1);
  assert.equal(payload.member_outputs[0].friend_name, "GPT-5.3 Codex");
  assert.equal(payload.member_outputs[0].content, "我是一个 AI 助手。");
});

test("buildSynthesisPromptText serializes payload with member outputs", () => {
  const text = buildSynthesisPromptText({
    prompt: "你是谁？",
    results: [{ name: "Claude", model: "claude", content: "我是 Claude。" }]
  });
  assert.match(text, /user_prompt/);
  assert.match(text, /你是谁/);
  assert.match(text, /Claude/);
});

test("buildFallbackSynthesis references prompt and participants", () => {
  const text = buildFallbackSynthesis({
    prompt: "你是谁？",
    language: "zh-CN",
    results: [{ name: "GPT-5.3 Codex" }, { name: "GPT5.4" }]
  });
  assert.match(text, /你是谁/);
  assert.match(text, /GPT-5.3 Codex/);
  assert.match(text, /GPT5.4/);
});
