import test from "node:test";
import assert from "node:assert/strict";

import { shouldBootstrapDefaultFriends } from "./friend-bootstrap-utils.mjs";

test("shouldBootstrapDefaultFriends only bootstraps when no stored friends exist", () => {
  assert.equal(shouldBootstrapDefaultFriends(null, [{ id: "m1" }]), true);
  assert.equal(shouldBootstrapDefaultFriends("", [{ id: "m1" }]), true);
  assert.equal(shouldBootstrapDefaultFriends("[]", [{ id: "m1" }]), false);
  assert.equal(shouldBootstrapDefaultFriends(null, []), false);
});
