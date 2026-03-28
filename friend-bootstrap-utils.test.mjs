import test from "node:test";
import assert from "node:assert/strict";

import {
  shouldBootstrapDefaultFriends,
  syncDefaultFriendsWithModels,
  getUsableFriendIds,
  getMissingDefaultFriendModelIds
} from "./friend-bootstrap-utils.mjs";

test("shouldBootstrapDefaultFriends only bootstraps when no stored friends exist", () => {
  assert.equal(shouldBootstrapDefaultFriends(null, [{ id: "m1" }]), true);
  assert.equal(shouldBootstrapDefaultFriends("", [{ id: "m1" }]), true);
  assert.equal(shouldBootstrapDefaultFriends("[]", [{ id: "m1" }]), false);
  assert.equal(shouldBootstrapDefaultFriends(null, []), false);
});

test("syncDefaultFriendsWithModels adds a default friend for each missing model", () => {
  const models = [
    { id: "chatgpt", name: "ChatGPT", avatar: "", description: "A" },
    { id: "claude", name: "Claude", avatar: "", description: "B" }
  ];
  const existingFriends = [
    {
      id: "friend-chatgpt",
      name: "Strategist GPT",
      avatar: "avatar-a",
      modelConfigId: "chatgpt",
      systemPrompt: "custom prompt",
      enabled: true,
      description: "Custom desc"
    }
  ];

  const result = syncDefaultFriendsWithModels(existingFriends, models, {
    getDefaultFriendSystemPrompt: (name) => `default:${name}`
  });

  assert.equal(result.length, 2);
  assert.deepEqual(result[0], existingFriends[0]);
  assert.deepEqual(result[1], {
    id: "friend-claude",
    name: "Claude",
    avatar: "",
    modelConfigId: "claude",
    systemPrompt: "default:Claude",
    enabled: true,
    description: "B"
  });
});

test("getMissingDefaultFriendModelIds reports models without a default friend", () => {
  const models = [
    { id: "chatgpt", name: "ChatGPT", enabled: true },
    { id: "claude", name: "Claude", enabled: true }
  ];
  const friends = [
    { id: "friend-chatgpt", modelConfigId: "chatgpt", enabled: true }
  ];

  assert.deepEqual(getMissingDefaultFriendModelIds(friends, models), ["claude"]);
});

test("getUsableFriendIds only returns enabled friends bound to enabled models", () => {
  const models = [
    { id: "chatgpt", enabled: true },
    { id: "claude", enabled: false }
  ];
  const friends = [
    { id: "friend-chatgpt", modelConfigId: "chatgpt", enabled: true },
    { id: "friend-claude", modelConfigId: "claude", enabled: true },
    { id: "friend-orphan", modelConfigId: "missing", enabled: true },
    { id: "friend-off", modelConfigId: "chatgpt", enabled: false }
  ];

  assert.deepEqual(getUsableFriendIds(friends, models), ["friend-chatgpt"]);
});
