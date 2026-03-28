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

test("syncDefaultFriendsWithModels skips invalid models without ids", () => {
  const models = [
    { name: "Missing Id", avatar: "", description: "Ignored" },
    { id: "claude", name: "Claude", avatar: "", description: "B" }
  ];

  const result = syncDefaultFriendsWithModels([], models, {
    getDefaultFriendSystemPrompt: (name) => `default:${name}`
  });

  assert.deepEqual(result, [
    {
      id: "friend-claude",
      name: "Claude",
      avatar: "",
      modelConfigId: "claude",
      systemPrompt: "default:Claude",
      enabled: true,
      description: "B"
    }
  ]);
});

test("syncDefaultFriendsWithModels preserves manual friends while backfilling model defaults", () => {
  const models = [
    { id: "chatgpt", name: "ChatGPT", avatar: "", description: "A" },
    { id: "claude", name: "Claude", avatar: "", description: "B" }
  ];
  const friends = [
    {
      id: "custom-mentor",
      name: "Mentor",
      avatar: "",
      modelConfigId: "chatgpt",
      systemPrompt: "mentor prompt",
      enabled: true,
      description: "manual"
    }
  ];

  const result = syncDefaultFriendsWithModels(friends, models, {
    getDefaultFriendSystemPrompt: (name) => `default:${name}`
  });

  assert.equal(result.length, 3);
  assert.equal(result[0].id, "custom-mentor");
  assert.equal(result[1].id, "friend-chatgpt");
  assert.equal(result[2].id, "friend-claude");
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

test("getUsableFriendIds ignores enabled friends whose models are missing", () => {
  const models = [{ id: "chatgpt", enabled: true }];
  const friends = [
    { id: "friend-chatgpt", modelConfigId: "chatgpt", enabled: true },
    { id: "friend-stale", modelConfigId: "claude", enabled: true }
  ];

  assert.deepEqual(getUsableFriendIds(friends, models), ["friend-chatgpt"]);
});

test("getUsableFriendIds ignores enabled friends without a bound model id", () => {
  const models = [{ id: "chatgpt", enabled: true }];
  const friends = [
    { id: "friend-chatgpt", modelConfigId: "chatgpt", enabled: true },
    { id: "friend-unbound", modelConfigId: "", enabled: true }
  ];

  assert.deepEqual(getUsableFriendIds(friends, models), ["friend-chatgpt"]);
});
