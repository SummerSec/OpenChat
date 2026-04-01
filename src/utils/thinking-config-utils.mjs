export function normalizeThinkingEnabled(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export function hasThinkingContent(message = {}) {
  return Boolean(String(message.thinking || "").trim());
}

/**
 * Extract <think>...</think> blocks from text, returning separated content and thinking.
 * Supports multiple <think> blocks and unclosed blocks.
 */
export function extractThinkBlocks(text) {
  if (!text || !text.includes("<think>")) return { content: text, thinking: "" };
  let content = "";
  let thinking = "";
  let remaining = text;
  while (remaining.length > 0) {
    const openIdx = remaining.indexOf("<think>");
    if (openIdx === -1) {
      content += remaining;
      break;
    }
    content += remaining.slice(0, openIdx);
    remaining = remaining.slice(openIdx + 7);
    const closeIdx = remaining.indexOf("</think>");
    if (closeIdx !== -1) {
      thinking += (thinking ? "\n" : "") + remaining.slice(0, closeIdx);
      remaining = remaining.slice(closeIdx + 8);
    } else {
      thinking += (thinking ? "\n" : "") + remaining;
      remaining = "";
    }
  }
  return { content: content.trim(), thinking: thinking.trim() };
}
