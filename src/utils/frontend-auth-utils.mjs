import { createHash } from "node:crypto";

function normalizeHash(value = "") {
  return String(value || "").trim().toLowerCase();
}

export function createMd5Hex(value = "") {
  return createHash("md5").update(String(value)).digest("hex");
}

export function validateFrontendPassword(password, expectedHash) {
  const normalizedHash = normalizeHash(expectedHash);
  if (!normalizedHash) return false;
  return createMd5Hex(password) === normalizedHash;
}

export function resolveFrontendPasswordHash({ envHash = "", configHash = "" } = {}) {
  return normalizeHash(envHash) || normalizeHash(configHash) || "";
}

export function hasUnlockedFrontendAccess({ expectedHash = "", storedHash = "" } = {}) {
  const normalizedExpected = normalizeHash(expectedHash);
  const normalizedStored = normalizeHash(storedHash);
  return Boolean(normalizedExpected) && normalizedExpected === normalizedStored;
}

export function shouldApplyLocalModelConfig({ currentModels = [], incomingModels = [] } = {}) {
  return Array.isArray(currentModels) && currentModels.length === 0 && Array.isArray(incomingModels) && incomingModels.length > 0;
}

export function shouldBootstrapLocalModels({ storedModelsRaw = null, incomingModels = [] } = {}) {
  return (storedModelsRaw === null || storedModelsRaw === "") && Array.isArray(incomingModels) && incomingModels.length > 0;
}
