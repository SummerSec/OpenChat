export function hasLiveProviderConfig(model = {}) {
  return Boolean(String(model.baseUrl || "").trim() && String(model.apiKey || "").trim());
}

export function detectProviderKind(model = {}) {
  const provider = String(model.provider || "").toLowerCase();
  const name = String(model.name || "").toLowerCase();
  if (provider.includes("anthropic") || name.includes("claude")) {
    return "anthropic";
  }
  if (provider.includes("google") || name.includes("gemini")) {
    return "gemini";
  }
  return "openai-compatible";
}
