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

export function getDefaultSynthesisSystemPrompt(language = "zh-CN") {
  if (language === "zh-CN") {
    return "你负责整合多位 AI 群友的输出。请务必阅读 user_prompt 与 member_outputs，基于它们生成最终整合答案，而不是忽略群友内容重新独立作答。输出时先总结共识，再说明关键分歧，最后给出一版清晰可执行的最终回答。";
  }
  return "You are responsible for synthesizing multiple AI friend outputs. Read user_prompt and member_outputs carefully, then generate a final synthesis instead of answering independently from scratch. Summarize consensus first, then disagreements, and finish with a clear actionable answer.";
}

export function buildFallbackSynthesis({ prompt = "", language = "zh-CN", results = [] } = {}) {
  const names = (results || []).map((item) => item.name).filter(Boolean);
  if (language === "zh-CN") {
    return `请围绕「${prompt || "当前问题"}」整合 ${names.join("、") || "群友"} 的回答：先提炼共识，再补充分歧与执行建议。`;
  }
  return `Synthesize the replies about "${prompt || "the current prompt"}" from ${names.join(", ") || "the selected friends"}: extract consensus first, then call out disagreements and execution advice.`;
}
