import test from "node:test";
import assert from "node:assert/strict";

import {
  createMd5Hex,
  hasUnlockedFrontendAccess,
  validateFrontendPassword,
  resolveFrontendPasswordHash,
  shouldApplyLocalModelConfig,
  shouldBootstrapLocalModels
} from "../utils/frontend-auth-utils.mjs";

test("createMd5Hex returns stable md5 hash", () => {
  assert.equal(createMd5Hex("openchat"), "1ce870e28bf13ccbd51aa0116f0de605");
});

test("validateFrontendPassword matches plain password to hash", () => {
  const hash = createMd5Hex("secret-123");
  assert.equal(validateFrontendPassword("secret-123", hash), true);
  assert.equal(validateFrontendPassword("secret-124", hash), false);
});

test("resolveFrontendPasswordHash prefers env hash over config hash", () => {
  assert.equal(
    resolveFrontendPasswordHash({ envHash: "env-hash", configHash: "config-hash" }),
    "env-hash"
  );
});

test("resolveFrontendPasswordHash falls back to config hash", () => {
  assert.equal(
    resolveFrontendPasswordHash({ envHash: "", configHash: "config-hash" }),
    "config-hash"
  );
});

test("hasUnlockedFrontendAccess requires matching stored hash", () => {
  assert.equal(hasUnlockedFrontendAccess({ expectedHash: "abc", storedHash: "abc" }), true);
  assert.equal(hasUnlockedFrontendAccess({ expectedHash: "abc", storedHash: "xyz" }), false);
  assert.equal(hasUnlockedFrontendAccess({ expectedHash: "", storedHash: "abc" }), false);
});

test("shouldApplyLocalModelConfig only applies when current models are empty", () => {
  assert.equal(shouldApplyLocalModelConfig({ currentModels: [], incomingModels: [{ id: "a" }] }), true);
  assert.equal(shouldApplyLocalModelConfig({ currentModels: [{ id: "existing" }], incomingModels: [{ id: "a" }] }), false);
  assert.equal(shouldApplyLocalModelConfig({ currentModels: [], incomingModels: [] }), false);
});

test("shouldBootstrapLocalModels only applies when no saved model config exists", () => {
  assert.equal(shouldBootstrapLocalModels({ storedModelsRaw: null, incomingModels: [{ id: "a" }] }), true);
  assert.equal(shouldBootstrapLocalModels({ storedModelsRaw: "", incomingModels: [{ id: "a" }] }), true);
  assert.equal(shouldBootstrapLocalModels({ storedModelsRaw: "[]", incomingModels: [{ id: "a" }] }), false);
});
