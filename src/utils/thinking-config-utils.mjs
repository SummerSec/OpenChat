export function normalizeThinkingEnabled(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export function hasThinkingContent(message = {}) {
  return Boolean(String(message.thinking || "").trim());
}
