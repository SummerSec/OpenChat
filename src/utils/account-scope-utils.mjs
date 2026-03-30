export function normalizeLocalAccount(input = {}) {
  const email = String(input.email || "admin").trim() || "admin";
  const workspace = String(input.workspace || input.name || "admin").trim() || "admin";
  return {
    email,
    name: workspace,
    workspace
  };
}

function normalizeScopePart(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "default";
}

export function buildScopedStorageKey(baseKey, account = {}) {
  const normalized = normalizeLocalAccount(account);
  return `${baseKey}::${normalizeScopePart(normalized.email)}::${normalizeScopePart(normalized.workspace)}`;
}
