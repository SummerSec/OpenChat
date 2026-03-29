import test from "node:test";
import assert from "node:assert/strict";

import {
  buildModelTestPrompt,
  describeModelTestFailure,
  describeNonJsonModelResponse
} from "./model-test-utils.mjs";

test("buildModelTestPrompt returns zh-CN prompt", () => {
  assert.equal(buildModelTestPrompt("zh-CN"), "请只回复：连接测试成功");
});

test("describeNonJsonModelResponse explains html homepage issue", () => {
  const result = describeNonJsonModelResponse("<!doctype html><html>", 200, "text/html");
  assert.equal(result.ok, false);
  assert.match(result.message, /returned HTML instead of JSON/i);
});

test("describeModelTestFailure explains fetch failures as likely cors", () => {
  const result = describeModelTestFailure({
    message: "Failed to fetch",
    language: "zh-CN",
    mode: "frontend"
  });
  assert.match(result.message, /CORS|后端模式/);
});

test("describeModelTestFailure explains http 500 as upstream issue", () => {
  const result = describeModelTestFailure({
    message: "HTTP 500",
    language: "zh-CN",
    mode: "frontend"
  });
  assert.match(result.message, /500/);
  assert.match(result.message, /上游|服务/);
});
