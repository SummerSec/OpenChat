import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveFriendProfilesForScope,
  shouldBootstrapDefaultFriends
} from "./friend-bootstrap-utils.mjs";

test("shouldBootstrapDefaultFriends only bootstraps when no stored friends exist", () => {
  assert.equal(shouldBootstrapDefaultFriends(null, [{ id: "m1" }]), true);
  assert.equal(shouldBootstrapDefaultFriends("", [{ id: "m1" }]), true);
  assert.equal(shouldBootstrapDefaultFriends("[]", [{ id: "m1" }]), false);
  assert.equal(shouldBootstrapDefaultFriends(null, []), false);
});

test("resolveFriendProfilesForScope bootstraps defaults when scoped friends are missing", () => {
  const defaultFriends = [{ id: "friend-chatgpt", modelConfigId: "chatgpt" }];

  assert.deepEqual(
    resolveFriendProfilesForScope({
      storedFriendsRaw: null,
      storedFriends: [],
      incomingModels: [{ id: "chatgpt" }],
      createDefaultFriendProfiles: () => defaultFriends
    }),
    defaultFriends
  );
});

test("resolveFriendProfilesForScope preserves explicit empty scoped friends", () => {
  assert.deepEqual(
    resolveFriendProfilesForScope({
      storedFriendsRaw: "[]",
      storedFriends: [],
      incomingModels: [{ id: "chatgpt" }],
      createDefaultFriendProfiles: () => [{ id: "friend-chatgpt", modelConfigId: "chatgpt" }]
    }),
    []
  );
});

test("resolveFriendProfilesForScope keeps saved friends when present", () => {
  const storedFriends = [{ id: "friend-custom", modelConfigId: "custom-1" }];

  assert.deepEqual(
    resolveFriendProfilesForScope({
      storedFriendsRaw: JSON.stringify(storedFriends),
      storedFriends,
      incomingModels: [{ id: "chatgpt" }],
      createDefaultFriendProfiles: () => [{ id: "friend-chatgpt", modelConfigId: "chatgpt" }]
    }),
    storedFriends
  );
});
