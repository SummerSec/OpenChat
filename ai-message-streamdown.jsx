import React from "react";
import { createRoot } from "react-dom/client";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";

import "streamdown/styles.css";

const streamdownRoots = new Map();

function resolveRenderOptions(kind = "", field = "content") {
  const isThinking = field === "thinking";
  const isSynthesis = kind === "synthesis";

  return {
    className: `markdown-content ${isSynthesis ? "markdown-content-rich" : "markdown-content-plain"}`,
    plugins: isSynthesis ? { code } : undefined,
    parseIncompleteMarkdown: true,
    animated: isSynthesis,
    isSynthesis,
    isThinking
  };
}

function AssistantMarkdown({ content = "", isLoading = false, kind = "", field = "content" }) {
  const options = resolveRenderOptions(kind, field);

  return (
    <Streamdown
      className={options.className}
      plugins={options.plugins}
      mode={options.isSynthesis ? "streaming" : "static"}
      isAnimating={options.isSynthesis && isLoading}
      caret={options.isSynthesis ? "block" : undefined}
      parseIncompleteMarkdown={options.parseIncompleteMarkdown}
      animated={options.animated}
      controls={false}
      skipHtml
    >
      {String(content || "")}
    </Streamdown>
  );
}

function mountStreamdownNode(node) {
  if (!(node instanceof HTMLElement)) return;

  const content = node.dataset.content || "";
  const isLoading = node.dataset.loading === "true";
  const kind = node.dataset.kind || "";
  const field = node.dataset.field || "content";

  let root = streamdownRoots.get(node);
  if (!root) {
    root = createRoot(node);
    streamdownRoots.set(node, root);
  }

  root.render(<AssistantMarkdown content={content} isLoading={isLoading} kind={kind} field={field} />);
}

function unmountRemovedRoots(activeNodes) {
  for (const [node, root] of streamdownRoots.entries()) {
    if (activeNodes.has(node)) continue;
    root.unmount();
    streamdownRoots.delete(node);
  }
}

export function renderAiMessageMarkdown(container = document) {
  const nodes = Array.from(container.querySelectorAll(".streamdown-target"));
  const activeNodes = new Set(nodes);

  nodes.forEach(mountStreamdownNode);
  unmountRemovedRoots(activeNodes);
}
