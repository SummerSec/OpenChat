import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPromptAwareMergedAnswer,
  buildPromptAwareMockResponse,
  extractPromptFocus
} from "./mock-response-utils.mjs";

test("extractPromptFocus keeps short prompts intact", () => {
  assert.equal(extractPromptFocus("做一个 AI 搜索首页"), "做一个 AI 搜索首页");
});

test("buildPromptAwareMockResponse mentions prompt focus in zh-CN", () => {
  const text = buildPromptAwareMockResponse({
    friendName: "ChatGPT",
    prompt: "请帮我设计一个 AI 搜索首页",
    language: "zh-CN"
  });
  assert.match(text, /AI 搜索首页/);
  assert.match(text, /ChatGPT/);
});

test("buildPromptAwareMockResponse mentions prompt focus in English", () => {
  const text = buildPromptAwareMockResponse({
    friendName: "Claude",
    prompt: "Design a clean AI search landing page",
    language: "en"
  });
  assert.match(text, /AI search landing page/i);
  assert.match(text, /Claude/);
});

test("buildPromptAwareMockResponse includes platform context when present", () => {
  const text = buildPromptAwareMockResponse({
    friendName: "Grok",
    prompt: "分析今天 AI 搜索的竞争格局",
    language: "zh-CN",
    platformName: "Grok",
    platformCompany: "xAI",
    platformStrengths: "实时热点和社交信号"
  });
  assert.match(text, /Grok/);
  assert.match(text, /实时热点和社交信号/);
});

test("buildPromptAwareMergedAnswer also reflects prompt focus", () => {
  const text = buildPromptAwareMergedAnswer("请给出一个 AI 搜索产品的冷启动计划", "zh-CN");
  assert.match(text, /AI 搜索产品的冷启动计划/);
});
