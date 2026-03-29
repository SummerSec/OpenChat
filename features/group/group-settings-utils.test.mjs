import test from "node:test";
import assert from "node:assert/strict";

import { countSelectedGroupMembers } from "./group-settings-utils.mjs";

test("countSelectedGroupMembers returns selected enabled member count", () => {
  assert.equal(
    countSelectedGroupMembers({
      memberIds: ["friend-1"],
      availableFriends: [
        { id: "friend-1" },
        { id: "friend-2" },
        { id: "friend-3" }
      ]
    }),
    1
  );
});

test("countSelectedGroupMembers ignores selected ids that are not currently available", () => {
  assert.equal(
    countSelectedGroupMembers({
      memberIds: ["friend-1", "friend-9"],
      availableFriends: [
        { id: "friend-1" },
        { id: "friend-2" }
      ]
    }),
    1
  );
});

test("countSelectedGroupMembers returns zero when nothing is selected", () => {
  assert.equal(
    countSelectedGroupMembers({
      memberIds: [],
      availableFriends: [{ id: "friend-1" }]
    }),
    0
  );
});
