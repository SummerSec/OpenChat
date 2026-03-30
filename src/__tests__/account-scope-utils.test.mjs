import test from "node:test";
import assert from "node:assert/strict";

import { buildScopedStorageKey, normalizeLocalAccount } from "../utils/account-scope-utils.mjs";

test("normalizeLocalAccount defaults to admin/admin", () => {
  assert.deepEqual(normalizeLocalAccount({}), {
    email: "admin",
    name: "admin",
    workspace: "admin"
  });
});

test("buildScopedStorageKey follows email and workspace", () => {
  assert.equal(
    buildScopedStorageKey("multiplechat-model-configs", { email: "Admin@Mail.com", workspace: "Admin Space" }),
    "multiplechat-model-configs::admin-mail-com::admin-space"
  );
});
