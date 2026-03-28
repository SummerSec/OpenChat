import { renderSafeMarkdown } from "./markdown-render-utils.mjs";

export function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderSynthesisContent(content = "") {
  try {
    return `<div class="ai-card-body markdown-content">${renderSafeMarkdown(content || "")}</div>`;
  } catch {
    return `<div class="ai-card-body">${escapeHtml(content || "")}</div>`;
  }
}

export function renderAssistantMessageContent({ content = "", isLoading = false, kind = "", loadingBody = "" } = {}) {
  if (!content && isLoading) {
    return loadingBody;
  }

  return kind === "synthesis"
    ? renderSynthesisContent(content || "")
    : `<div class="ai-card-body">${escapeHtml(content || "")}</div>`;
}
