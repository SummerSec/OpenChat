export function extractPromptFocus(prompt = "", limit = 72) {
  const normalized = String(prompt || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}...`;
}

export function buildPromptAwareMockResponse({
  friendName = "AI",
  prompt = "",
  language = "zh-CN",
  platformName = "",
  platformCompany = "",
  platformStrengths = ""
} = {}) {
  const focus = extractPromptFocus(prompt);
  if (language === "zh-CN") {
    return [
      `${friendName} 的默认回复会围绕你的问题展开：${focus || "当前输入"}。`,
      "我会先给一个直接可执行的判断，再补充原因、优先级和下一步建议。",
      platformName
        ? `这次我会优先沿着 ${platformName}${platformCompany ? `（${platformCompany}）` : ""} 的信息视角来组织回答${platformStrengths ? `，重点参考：${platformStrengths}` : ""}。`
        : ""
    ]
      .filter(Boolean)
      .join("\n\n");
  }
  return [
    `${friendName}'s fallback answer is centered on your request: ${focus || "the current prompt"}.`,
    "I will start with the most actionable answer, then add rationale, tradeoffs, and next steps.",
    platformName
      ? `For this run, I am leaning on the ${platformName}${platformCompany ? ` (${platformCompany})` : ""} perspective${platformStrengths ? `, especially ${platformStrengths}` : ""}.`
      : ""
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildPromptAwareMergedAnswer(prompt = "", language = "zh-CN") {
  const focus = extractPromptFocus(prompt);
  if (language === "zh-CN") {
    return `整合答案会围绕「${focus || "当前问题"}」来组织：先收敛共同结论，再补上关键分歧、执行顺序和需要验证的风险点。`;
  }
  return `The merged answer for "${focus || "the current prompt"}" prioritizes shared conclusions first, then organizes disagreements, execution order, and risks to verify.`;
}
