/**
 * Conversation Export Utilities
 * Supports exporting conversations as HTML, Image (PNG), and PDF.
 */

import { renderSafeMarkdown } from "./markdown-render-utils.mjs";

/**
 * Sanitize a string for use in a filename.
 * @param {string} text
 * @returns {string}
 */
function sanitizeFilename(text) {
  return String(text || "untitled")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60)
    .replace(/-+$/, "");
}

/**
 * Get a date string for filenames (YYYY-MM-DD).
 * @returns {string}
 */
function getDateStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Escape HTML entities.
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Trigger a file download from a Blob.
 * @param {Blob} blob
 * @param {string} filename
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Build message HTML from a normalized conversation message.
 * @param {Object} msg - Normalized conversation message
 * @param {Object} options
 * @returns {string}
 */
function buildMessageHtml(msg, { userName = "You", synthesisLabel = "Merged" } = {}) {
  const time = new Date(msg.createdAt).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  });

  if (msg.kind === "user") {
    return `
      <article class="message-row user">
        <div class="message-avatar avatar-user">
          <span class="avatar-fallback">${escapeHtml(userName.slice(0, 2).toUpperCase())}</span>
        </div>
        <div class="message-stack">
          <div class="message-head message-head-user">
            <span class="message-name">${escapeHtml(userName)}</span>
            <time class="message-time">${escapeHtml(time)}</time>
          </div>
          <div class="message-bubble">${escapeHtml(msg.content)}</div>
        </div>
      </article>`;
  }

  const isSynthesis = msg.kind === "synthesis";
  const name = msg.name || "AI";
  const avatarInitials = (msg.avatar ? "" : name.slice(0, 2).toUpperCase());
  const avatarHtml = msg.avatar
    ? `<img src="${escapeHtml(msg.avatar)}" alt="${escapeHtml(name)}" class="avatar-image">`
    : `<span class="avatar-fallback">${escapeHtml(avatarInitials)}</span>`;
  const variant = isSynthesis ? "synthesis" : "assistant";
  const roleLabel = isSynthesis ? synthesisLabel : "AI";
  const bubbleClass = isSynthesis ? "message-bubble ai-bubble synthesis-bubble" : "message-bubble ai-bubble";

  let thinkingHtml = "";
  if (msg.thinking && String(msg.thinking).trim()) {
    thinkingHtml = `
      <div class="ai-bubble-thinking">
        <details class="think-block">
          <summary class="think-summary">
            <span class="think-summary-main">Thinking</span>
          </summary>
          <div class="think-content pretext">${escapeHtml(msg.thinking)}</div>
        </details>
      </div>`;
  }

  const renderedContent = renderSafeMarkdown(msg.content);

  return `
    <div class="message-row assistant${isSynthesis ? " synthesis-row" : ""}">
      <div class="message-avatar avatar-${variant}">
        ${avatarHtml}
      </div>
      <div class="message-stack">
        <div class="message-head">
          <span class="message-name">${escapeHtml(name)}</span>
          <span class="message-role">${escapeHtml(roleLabel)}</span>
          ${isSynthesis ? `<span class="synthesis-badge">${escapeHtml(synthesisLabel)}</span>` : ""}
          <time class="message-time">${escapeHtml(time)}</time>
        </div>
        <div class="${bubbleClass}">
          ${thinkingHtml}
          <div class="ai-bubble-content">
            <div class="message-content markdown-body">${renderedContent}</div>
          </div>
        </div>
      </div>
    </div>`;
}

/** Shared inline CSS for exported documents */
const EXPORT_CSS = `
/* Reset & Base */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: "Inter", "Source Sans 3", system-ui, -apple-system, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* Theme Variables - Sky Blue Light */
:root {
  --bg-primary: #f0f9ff;
  --bg-secondary: #e0f2fe;
  --bg-panel: rgba(255, 255, 255, 0.96);
  --bg-panel-solid: #ffffff;
  --border: #bae6fd;
  --border-subtle: rgba(56, 189, 248, 0.08);
  --text-primary: #0c4a6e;
  --text-secondary: #0369a1;
  --text-muted: #0ea5e9;
  --text: #0c4a6e;
  --accent: #0284c7;
  --accent-hover: #0369a1;
  --accent-soft: rgba(2, 132, 199, 0.1);
  --accent-glow: rgba(2, 132, 199, 0.15);
  --line: #bae6fd;
  --caption: #0ea5e9;
  --muted: #64748b;
  --message-list-max-width: 880px;
}

/* Export Header */
.export-header {
  max-width: 880px;
  margin: 0 auto;
  padding: 24px 16px 8px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 8px;
}
.export-header h1 {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text-primary);
}
.export-header .export-meta {
  font-size: 0.8rem;
  color: var(--muted);
  margin-top: 4px;
}

/* Message Stream */
.message-stream {
  max-width: 880px;
  margin: 0 auto;
  padding: 18px 12px 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* Message Row */
.message-row {
  width: 100%;
  max-width: var(--message-list-max-width);
  margin: 0 auto;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 10px;
}
.message-row + .message-row { margin-top: 8px; }

.message-stack {
  display: grid;
  justify-items: end;
  gap: 4px;
  min-width: 0;
}

.message-row.assistant {
  justify-content: flex-start;
  align-items: flex-start;
}
.message-row.assistant .message-stack { justify-items: start; }
.message-row.assistant .message-head { justify-content: flex-start; }

/* Message Head */
.message-head {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--caption);
  font-size: 0.75rem;
}
.message-head-user { justify-content: flex-end; }
.message-name { color: var(--text-primary); font-weight: 700; }
.message-role, .message-time { color: var(--caption); }

/* Avatar */
.message-avatar {
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  border-radius: 50%;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: var(--bg-secondary);
  border: 1px solid var(--line);
  box-shadow: 0 10px 24px rgba(44, 36, 32, 0.06);
  margin-top: 2px;
}
.avatar-user {
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%);
  color: #fff;
  border: 0;
}
.avatar-fallback {
  display: inline-grid;
  place-items: center;
  width: 100%;
  height: 100%;
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--text-primary);
}
.avatar-user .avatar-fallback { color: #fff; }
.avatar-image { width: 100%; height: 100%; object-fit: cover; }

/* Message Bubble */
.message-bubble {
  max-width: min(760px, 82%);
  padding: 13px 17px;
  border-radius: 22px;
  border-bottom-right-radius: 8px;
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%);
  color: #fff;
  line-height: 1.64;
  font-size: 0.93rem;
  white-space: pre-wrap;
  box-shadow: 0 20px 40px var(--accent-glow);
  overflow-wrap: anywhere;
}
.message-bubble.ai-bubble {
  background: var(--bg-panel);
  color: var(--text-primary);
  border: 1px solid var(--line);
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 22px;
  box-shadow: 0 18px 42px rgba(44, 36, 32, 0.06);
  max-width: min(760px, 92%);
  padding: 0;
  overflow: hidden;
  white-space: normal;
}
.message-bubble.synthesis-bubble {
  border-color: var(--accent-soft);
  box-shadow: 0 18px 42px var(--accent-soft);
}

/* AI Bubble Content */
.ai-bubble-content { padding: 16px 18px; }
.ai-bubble-content table {
  width: 100%;
  border-collapse: collapse;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  margin: 0.6em 0;
  font-size: 0.93em;
}
.ai-bubble-content th, .ai-bubble-content td {
  padding: 0.55rem 0.7rem;
  text-align: left;
  border-bottom: 1px solid var(--border-subtle);
}
.ai-bubble-content th { background: rgba(0, 0, 0, 0.03); font-weight: 700; }
.ai-bubble-content tr:last-child td { border-bottom: 0; }
.ai-bubble-content hr { margin: 1em 0; border: 0; border-top: 1px solid var(--border-subtle); }
.ai-bubble-content h1, .ai-bubble-content h2, .ai-bubble-content h3,
.ai-bubble-content h4, .ai-bubble-content h5, .ai-bubble-content h6 {
  margin: 1.2em 0 0.5em;
  line-height: 1.3;
}
.ai-bubble-content h1:first-child, .ai-bubble-content h2:first-child,
.ai-bubble-content h3:first-child, .ai-bubble-content h4:first-child {
  margin-top: 0;
}
.ai-bubble-content p { margin: 0 0 0.75em; }
.ai-bubble-content > :last-child { margin-bottom: 0; }

/* Code blocks */
.ai-bubble-content pre {
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 12px 14px;
  overflow-x: auto;
  margin: 0.6em 0;
  font-size: 0.88em;
}
.ai-bubble-content code {
  font-family: "IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 0.9em;
}
.ai-bubble-content :not(pre) > code {
  background: var(--bg-secondary);
  padding: 2px 6px;
  border-radius: 4px;
}

/* Lists */
.ai-bubble-content ul, .ai-bubble-content ol {
  margin: 0.5em 0;
  padding-left: 1.5em;
}
.ai-bubble-content li { margin: 0.25em 0; }

/* Thinking Block */
.ai-bubble-thinking { margin-bottom: 12px; }
.think-block {
  border: 1px solid var(--accent-soft);
  border-radius: 14px;
  background: var(--accent-soft);
}
.think-summary {
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  color: var(--accent);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.think-summary::-webkit-details-marker { display: none; }
.think-summary-main {
  display: flex;
  align-items: center;
  gap: 8px;
}
.think-summary-main::before {
  content: "\\203A";
  font-size: 1.1rem;
  transition: transform 180ms ease;
}
.think-block[open] .think-summary-main::before { transform: rotate(90deg); }
.think-content {
  padding: 12px 14px;
  color: var(--text-secondary);
  font-size: 0.85rem;
  line-height: 1.7;
  white-space: pre-wrap;
  background: var(--bg-panel);
  border-bottom-left-radius: 13px;
  border-bottom-right-radius: 13px;
}
.pretext { white-space: pre-wrap; }

/* Synthesis Badge */
.synthesis-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.68rem;
  font-weight: 700;
}

/* Footer */
.export-footer {
  max-width: 880px;
  margin: 24px auto;
  padding: 16px;
  text-align: center;
  font-size: 0.75rem;
  color: var(--muted);
  border-top: 1px solid var(--line);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #1a1815;
    --bg-secondary: #252320;
    --bg-panel: rgba(35, 33, 30, 0.96);
    --bg-panel-solid: #23211e;
    --border: #3d3934;
    --border-subtle: rgba(255, 255, 255, 0.05);
    --text-primary: #f5f0e8;
    --text-secondary: #a89b8c;
    --text-muted: #7a6d60;
    --text: #f5f0e8;
    --accent: #d97a52;
    --accent-hover: #e8936e;
    --accent-soft: rgba(217, 122, 82, 0.12);
    --accent-glow: rgba(217, 122, 82, 0.2);
    --line: #3d3934;
    --caption: #7a6d60;
    --muted: #7a6d60;
  }
}
`;

/**
 * Build a full self-contained HTML document for a conversation.
 * Shared by all three export formats.
 * @param {Object[]} messages
 * @param {Object} options
 * @returns {string}
 */
function buildExportHtml(messages, { title = "OpenChat Conversation", userName = "You", synthesisLabel = "Merged" } = {}) {
  const messagesHtml = messages
    .filter((msg) => msg.content || msg.kind === "user")
    .map((msg) => buildMessageHtml(msg, { userName, synthesisLabel }))
    .join("\n");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} - OpenChat</title>
<style>${EXPORT_CSS}</style>
</head>
<body>
  <header class="export-header">
    <h1>${escapeHtml(title)}</h1>
    <p class="export-meta">Exported from OpenChat on ${escapeHtml(getDateStamp())}</p>
  </header>
  <div class="message-stream">
    ${messagesHtml}
  </div>
  <footer class="export-footer">
    Exported from OpenChat
  </footer>
</body>
</html>`;
}

/**
 * Export a conversation session as a self-contained HTML file.
 * @param {Object[]} messages - Normalized conversation messages
 * @param {Object} options
 */
export function exportToHtml(messages, options = {}) {
  const title = options.title || "OpenChat Conversation";
  const html = buildExportHtml(messages, options);
  const filename = `OpenChat-${sanitizeFilename(title)}-${getDateStamp()}.html`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  downloadBlob(blob, filename);
}

/**
 * Create a hidden iframe, write HTML into it, and wait for it to load.
 * @param {string} html - Full HTML document string
 * @returns {Promise<HTMLIFrameElement>}
 */
function createExportIframe(html) {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:960px;height:800px;border:0;opacity:0;pointer-events:none;";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    // Wait for rendering to settle
    setTimeout(() => resolve(iframe), 300);
  });
}

/**
 * Export a conversation as a PNG image.
 * Renders the conversation into a hidden iframe, then uses html2canvas to capture it.
 * @param {Object[]} messages - Normalized conversation messages
 * @param {Object} options
 */
export async function exportToImage(messages, options = {}) {
  const title = options.title || "OpenChat Conversation";
  const html = buildExportHtml(messages, options);
  const iframe = await createExportIframe(html);

  try {
    // Load html2canvas into the iframe
    const iframeWindow = iframe.contentWindow;
    const iframeDoc = iframe.contentDocument;

    // Resize iframe to fit all content
    const body = iframeDoc.body;
    const contentHeight = body.scrollHeight;
    const contentWidth = body.scrollWidth;
    iframe.style.width = Math.max(contentWidth, 960) + "px";
    iframe.style.height = contentHeight + "px";

    // Wait for resize to take effect
    await new Promise((r) => setTimeout(r, 100));

    let html2canvas = iframeWindow.html2canvas;
    if (!html2canvas) {
      await new Promise((resolve, reject) => {
        const script = iframeDoc.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
        script.onload = () => {
          html2canvas = iframeWindow.html2canvas;
          resolve();
        };
        script.onerror = () => reject(new Error("Failed to load html2canvas"));
        iframeDoc.head.appendChild(script);
      });
    }

    const canvas = await html2canvas(body, {
      backgroundColor: "#f0f9ff",
      useCORS: true,
      scale: 2,
      width: Math.max(contentWidth, 960),
      height: contentHeight,
      scrollX: 0,
      scrollY: 0
    });

    await new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const filename = `OpenChat-${sanitizeFilename(title)}-${getDateStamp()}.png`;
          downloadBlob(blob, filename);
        }
        resolve();
      }, "image/png");
    });
  } finally {
    document.body.removeChild(iframe);
  }
}

/**
 * Export a conversation as PDF by opening the rendered content in a new window
 * and triggering the browser print dialog.
 * @param {Object[]} messages - Normalized conversation messages
 * @param {Object} options
 */
export function exportToPdf(messages, options = {}) {
  const html = buildExportHtml(messages, options);
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("Popup blocked — please allow popups for this site");
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  // Wait for content to render, then trigger print
  printWindow.addEventListener("load", () => {
    printWindow.print();
  });
  // Fallback if load doesn't fire
  setTimeout(() => {
    printWindow.print();
  }, 500);
}
