export function buildSynthesisPayload({ prompt = "", language = "zh-CN", results = [] } = {}) {
  return {
    user_prompt: String(prompt || ""),
    language,
    member_outputs: Array.isArray(results)
      ? results.map((item) => ({
          friend_name: item.name || "",
          model: item.model || "",
          provider: item.provider || "",
          content: item.content || "",
          thinking: item.thinking || "",
          source: item.source || ""
        }))
      : []
  };
}

export function buildSynthesisPromptText({ prompt = "", language = "zh-CN", results = [] } = {}) {
  const payload = buildSynthesisPayload({ prompt, language, results });
  return JSON.stringify(payload, null, 2);
}

export function buildFallbackSynthesis({ prompt = "", language = "zh-CN", results = [] } = {}) {
  const names = (results || []).map((item) => item.name).filter(Boolean);
  if (language === "zh-CN") {
    return `请围绕「${prompt || "当前问题"}」整合 ${names.join("、") || "群友"} 的回答：先提炼共识，再补充分歧与执行建议。`;
  }
  return `Synthesize the replies about "${prompt || "the current prompt"}" from ${names.join(", ") || "the selected friends"}: extract consensus first, then call out disagreements and execution advice.`;
}
