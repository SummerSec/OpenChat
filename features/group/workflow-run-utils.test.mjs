import test from "node:test";
import assert from "node:assert/strict";

import { getWorkflowPreflightState } from "./workflow-run-utils.mjs";

test("getWorkflowPreflightState returns missing_friends when no friends exist", () => {
  assert.equal(
    getWorkflowPreflightState({
      prompt: "hello",
      friendProfiles: [],
      activeFriends: [{ id: "friend-1" }]
    }),
    "missing_friends"
  );
});

test("getWorkflowPreflightState returns missing_prompt when prompt is blank", () => {
  assert.equal(
    getWorkflowPreflightState({
      prompt: "   ",
      friendProfiles: [{ id: "friend-1" }],
      activeFriends: [{ id: "friend-1" }]
    }),
    "missing_prompt"
  );
});

test("getWorkflowPreflightState returns missing_active_friends when prompt exists but no active friends are runnable", () => {
  assert.equal(
    getWorkflowPreflightState({
      prompt: "hello",
      friendProfiles: [{ id: "friend-1" }],
      activeFriends: []
    }),
    "missing_active_friends"
  );
});

test("getWorkflowPreflightState returns ready when prompt and active friends exist", () => {
  assert.equal(
    getWorkflowPreflightState({
      prompt: "hello",
      friendProfiles: [{ id: "friend-1" }],
      activeFriends: [{ id: "friend-1" }]
    }),
    "ready"
  );
});
