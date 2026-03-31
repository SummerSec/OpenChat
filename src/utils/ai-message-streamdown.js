import { createElement } from "react";
import { createRoot } from "react-dom/client";
import AssistantMarkdown from "./streamdown-markdown.jsx";

// Map to store React roots by messageId for persistent streaming
const streamdownRoots = new Map();

function mountOrUpdateStreamdownNode(node) {
  if (!(node instanceof HTMLElement)) return;

  const content = node.dataset.content || "";
  const isLoading = node.dataset.loading === "true";
  const messageId = node.dataset.messageid || node.dataset.messageId || "";

  const key = messageId || node;
  let root = streamdownRoots.get(key);

  // If the stored root was created on a different DOM node (vanilla JS rebuilt
  // the message element), discard the stale root and create a fresh one.
  if (root && root._node && root._node !== node) {
    try {
      queueMicrotask(() => { try { root.unmount(); } catch { /* ignore */ } });
    } catch { /* ignore */ }
    streamdownRoots.delete(key);
    root = null;
  }

  if (!root) {
    const savedContent = node.dataset.content;
    const savedLoading = node.dataset.loading;
    const savedMessageId = node.dataset.messageid;

    node.innerHTML = "";

    node.dataset.content = savedContent;
    node.dataset.loading = savedLoading;
    node.dataset.messageid = savedMessageId;

    root = createRoot(node);
    root._node = node;
    streamdownRoots.set(key, root);
  }

  root.render(createElement(AssistantMarkdown, { content, isLoading }));
}

function unmountRemovedRoots(activeKeys) {
  for (const [key, root] of streamdownRoots.entries()) {
    if (activeKeys.has(key)) continue;
    try {
      queueMicrotask(() => {
        try { root.unmount(); } catch { /* detached DOM — safe to ignore */ }
      });
    } catch {
      // Ignore
    }
    streamdownRoots.delete(key);
  }
}

export function renderAiMessageMarkdown(container = document) {
  const nodes = Array.from(container.querySelectorAll(".streamdown-target"));
  const activeKeys = new Set();

  nodes.forEach((node) => {
    const messageId = node.dataset.messageid || node.dataset.messageId;
    if (messageId) {
      activeKeys.add(messageId);
    } else {
      activeKeys.add(node);
    }
    // Mount Streamdown for ALL nodes (both streaming and completed).
    // Streamdown handles streaming natively via isAnimating prop.
    mountOrUpdateStreamdownNode(node);
  });

  unmountRemovedRoots(activeKeys);
}

/**
 * Directly update content for a specific message.
 * Called during streaming to update content without full re-render.
 */
export function updateMessageContent(messageId, content, isLoading = false) {
  if (!messageId) return false;

  function findNode(id) {
    return document.querySelector(`[data-messageid="${id}"] .streamdown-target`)
      || document.querySelector(`.streamdown-target[data-messageid="${id}"]`)
      || document.querySelector(`[data-message-id="${id}"] .streamdown-target`)
      || document.querySelector(`.streamdown-target[data-message-id="${id}"]`);
  }

  const root = streamdownRoots.get(messageId);
  if (!root) {
    const node = findNode(messageId);
    if (node) {
      mountOrUpdateStreamdownNode(node);
      return true;
    }
    return false;
  }

  const node = findNode(messageId);
  if (node) {
    node.dataset.content = content;
    node.dataset.loading = String(isLoading);
  }

  root.render(createElement(AssistantMarkdown, { content, isLoading }));
  return true;
}
