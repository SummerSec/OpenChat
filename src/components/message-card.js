/**
 * Message Card Components - Vercel AI Elements inspired
 * Component primitives for composing chat message cards
 * Native JS implementation with composable architecture
 */

import { renderSafeMarkdown } from "../utils/markdown-render-utils.mjs";

// ============================================================================
// Component Primitives - Base building blocks
// ============================================================================

/**
 * Create a DOM element with attributes and children
 * @param {string} tag - HTML tag name
 * @param {Object} props - Attributes and properties
 * @param {(HTMLElement|string)[]} children - Child elements or text
 * @returns {HTMLElement}
 */
export function h(tag, props = {}, children = []) {
  const el = document.createElement(tag);

  Object.entries(props).forEach(([key, value]) => {
    if (key === "className") {
      el.className = value;
    } else if (key === "innerHTML") {
      el.innerHTML = value;
    } else if (key === "dataset") {
      Object.entries(value).forEach(([k, v]) => {
        el.dataset[k] = v;
      });
    } else if (key.startsWith("on") && typeof value === "function") {
      const event = key.slice(2).toLowerCase();
      el.addEventListener(event, value);
    } else if (key === "style" && typeof value === "object") {
      Object.assign(el.style, value);
    } else {
      el.setAttribute(key, value);
    }
  });

  children.forEach((child) => {
    if (typeof child === "string") {
      el.appendChild(document.createTextNode(child));
    } else if (child instanceof HTMLElement) {
      el.appendChild(child);
    } else if (child === null || child === undefined) {
      // Skip null/undefined children
    } else {
      el.appendChild(document.createTextNode(String(child)));
    }
  });

  return el;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// Avatar Components
// ============================================================================

/**
 * Avatar component for message sender
 * @param {Object} props
 * @param {string} props.name - Display name
 * @param {string} props.fallback - Fallback text (default: first 2 chars)
 * @param {string} props.avatar - Avatar image URL (optional)
 * @param {string} props.variant - 'user' | 'assistant' | 'synthesis'
 * @returns {HTMLElement}
 */
export function Avatar({ name, fallback, avatar, variant = "assistant" }) {
  const displayFallback = fallback || name?.slice(0, 2).toUpperCase() || "AI";

  return h(
    "div",
    { className: `message-avatar avatar-${variant}` },
    [
      avatar
        ? h("img", { src: avatar, alt: name, className: "avatar-image" })
        : h("span", { className: "avatar-fallback" }, [displayFallback])
    ]
  );
}

/**
 * Provider icon with SVG support
 * @param {Object} props
 * @param {string} props.provider - Provider name
 * @param {string} props.fallback - Fallback text
 * @returns {HTMLElement}
 */
export function ProviderIcon({ provider, fallback = "AI" }) {
  const providerLower = (provider || "").toLowerCase();

  // Map of known providers to their icon identifiers
  const iconMap = {
    openai: "openai",
    anthropic: "anthropic",
    google: "google",
    xai: "xai",
    grok: "xai",
    deepseek: "deepseek",
    azure: "azure",
    gemini: "google"
  };

  const iconKey = iconMap[providerLower];
  const iconPath = iconKey
    ? `src/assets/provider-icons/${iconKey}.svg`
    : null;

  return h(
    "span",
    { className: `provider-icon provider-${providerLower}` },
    [h("span", { className: "avatar-fallback" }, [fallback])]
  );
}

// ============================================================================
// Message Header Components
// ============================================================================

/**
 * Message timestamp
 * @param {Object} props
 * @param {Date|string} props.timestamp
 * @returns {HTMLElement}
 */
export function MessageTime({ timestamp }) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const formatted = date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  });

  return h("time", { className: "message-time" }, [formatted]);
}

/**
 * Message role badge
 * @param {Object} props
 * @param {string} props.role - Role text
 * @param {boolean} props.isLoading - Show loading state
 * @returns {HTMLElement}
 */
export function RoleBadge({ role, isLoading = false }) {
  return h(
    "span",
    { className: `message-role ${isLoading ? "message-role--loading" : ""}` },
    [role]
  );
}

/**
 * Synthesis badge for merged answers
 * @param {Object} props
 * @param {string} props.label - Badge text
 * @returns {HTMLElement}
 */
export function SynthesisBadge({ label = "整合" }) {
  return h("span", { className: "synthesis-badge" }, [label]);
}

/**
 * Copy button component
 * @param {Object} props
 * @param {Function} props.onCopy - Copy handler
 * @param {string} props.label - Button label
 * @returns {HTMLElement}
 */
/**
 * Copy icon SVG
 * @returns {HTMLElement}
 */
export function CopyIcon() {
  return h(
    "svg",
    {
      className: "copy-icon-svg",
      viewBox: "0 0 24 24",
      width: "16",
      height: "16",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    },
    [
      h("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2", ry: "2" }),
      h("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })
    ]
  );
}

/**
 * Check icon SVG for copied state
 * @returns {HTMLElement}
 */
export function CheckIcon() {
  return h(
    "svg",
    {
      className: "copy-icon-svg",
      viewBox: "0 0 24 24",
      width: "16",
      height: "16",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    },
    [h("polyline", { points: "20 6 9 17 4 12" })]
  );
}

/**
 * Copy button component with text label
 * @param {Object} props
 * @param {Function} props.onCopy - Copy handler
 * @param {string} props.label - Button label
 * @returns {HTMLElement}
 */
export function CopyButton({ onCopy, label = "复制" }) {
  const btn = h(
    "button",
    {
      className: "message-action-btn message-copy-btn",
      title: label,
      onClick: (e) => {
        e.stopPropagation();
        onCopy();
      }
    },
    [
      CopyIcon(),
      h("span", { className: "copy-label" }, [label])
    ]
  );
  return btn;
}

/**
 * Complete message header
 * @param {Object} props
 * @param {string} props.name - Sender name
 * @param {string} props.role - Role label
 * @param {Date} props.timestamp - Message time
 * @param {boolean} props.isSynthesis - Is synthesis message
 * @param {boolean} props.isLoading - Loading state
 * @param {string} props.synthesisLabel - Synthesis badge text
 * @param {Function} props.onCopy - Copy handler
 * @returns {HTMLElement}
 */
export function MessageHeader({
  name,
  role,
  timestamp,
  isSynthesis = false,
  isLoading = false,
  synthesisLabel = "整合",
  onCopy
}) {
  const children = [
    h("span", { className: "message-name" }, [escapeHtml(name)]),
    RoleBadge({ role, isLoading })
  ];

  if (isSynthesis) {
    children.push(SynthesisBadge({ label: synthesisLabel }));
  }

  children.push(MessageTime({ timestamp }));

  // Add copy button if provided
  if (onCopy && !isLoading) {
    children.push(
      h("div", { className: "message-actions" }, [
        CopyButton({ onCopy })
      ])
    );
  }

  return h(
    "div",
    { className: "message-head" },
    children
  );
}

// ============================================================================
// Content Components
// ============================================================================

/**
 * Skeleton loader for loading states
 * @param {Object} props
 * @param {number} props.lines - Number of skeleton lines
 * @returns {HTMLElement}
 */
export function SkeletonLoader({ lines = 3 }) {
  const widths = ["w-72", "w-100", "w-84", "w-60", "w-90"];

  const skeletonLines = Array.from({ length: lines }, (_, i) =>
    h("span", {
      className: `skeleton-line ${widths[i % widths.length]}`,
      "aria-hidden": "true"
    })
  );

  return h("div", { className: "ai-card-loading", "aria-hidden": "true" },
    skeletonLines
  );
}

/**
 * Thinking block - collapsible reasoning content
 * @param {Object} props
 * @param {string} props.thinking - Thinking content
 * @param {string} props.summaryText - Summary label
 * @param {string} props.toggleText - Toggle button text
 * @returns {HTMLElement}
 */
export function ThinkingBlock({
  thinking,
  summaryText = "思考过程",
  toggleText = "查看"
}) {
  const details = h("details", { className: "think-block" });

  const summary = h("summary", { className: "think-summary" }, [
    h("span", { className: "think-summary-main" }, [summaryText]),
    h("span", { className: "think-toggle-btn" }, [toggleText])
  ]);

  const content = h("div", { className: "think-content pretext" }, [
    escapeHtml(thinking)
  ]);

  details.appendChild(summary);
  details.appendChild(content);

  // Add click handler to ensure toggle works
  summary.addEventListener("click", (e) => {
    e.preventDefault();
    details.open = !details.open;
    const btn = details.querySelector(".think-toggle-btn");
    if (btn) {
      btn.textContent = details.open ? "隐藏" : toggleText;
    }
  });

  return details;
}

/**
 * Message bubble content with markdown rendering
 * @param {Object} props
 * @param {string} props.content - Message text
 * @param {boolean} props.isLoading - Show skeleton loader
 * @param {string} props.loadingBody - Custom loading content
 * @returns {HTMLElement}
 */
export function MessageContent({
  content,
  isLoading = false,
  loadingBody = null,
  messageId = ""
}) {
  const container = h("div", { className: "ai-bubble-content" });

  // Show skeleton loader when loading and no content yet
  // This is separate from streamdown-target to avoid conflicts
  if (isLoading && !content) {
    container.appendChild(SkeletonLoader({ lines: 3 }));
  }

  // Always create streamdown-target node for streaming support
  const contentDiv = h("div", {
    className: `message-content markdown-body streamdown-target ${isLoading ? "is-loading" : ""}`,
    dataset: {
      content: content || "",
      loading: String(isLoading),
      messageid: messageId || ""
    }
  });

  // Pre-render markdown for non-streaming messages (fallback)
  if (!isLoading && content) {
    contentDiv.innerHTML = renderSafeMarkdown(content);
  }

  container.appendChild(contentDiv);
  return container;
}

/**
 * Complete message bubble with optional thinking section
 * @param {Object} props
 * @param {string} props.content - Message content
 * @param {string} props.thinking - Thinking content (optional)
 * @param {boolean} props.isLoading - Loading state
 * @param {boolean} props.isSynthesis - Is synthesis message
 * @returns {HTMLElement}
 */
export function MessageBubble({
  content,
  thinking,
  isLoading = false,
  isSynthesis = false,
  messageId = ""
}) {
  const bubbleClass = [
    "message-bubble",
    "ai-bubble",
    isSynthesis ? "synthesis-bubble" : "",
    isLoading ? "is-loading" : ""
  ].filter(Boolean).join(" ");

  const bubble = h("div", { className: bubbleClass });

  // Show thinking if present (check for non-empty string)
  const hasThinking = thinking && String(thinking).trim().length > 0;
  if (hasThinking) {
    const thinkingSection = h("div", { className: "ai-bubble-thinking" }, [
      ThinkingBlock({ thinking: String(thinking).trim() })
    ]);
    bubble.appendChild(thinkingSection);
  }

  const contentEl = MessageContent({ content, isLoading, messageId });
  bubble.appendChild(contentEl);

  return bubble;
}

// ============================================================================
// Complete Message Cards
// ============================================================================

/**
 * User message card
 * @param {Object} props
 * @param {string} props.content - Message text
 * @param {Date} props.timestamp - Message time
 * @param {string} props.userName - User display name
 * @returns {HTMLElement}
 */
export function UserMessageCard({
  content,
  timestamp,
  userName = "我",
  onCopy
}) {
  return h(
    "article",
    { className: "message-row user" },
    [
      Avatar({ name: userName, variant: "user" }),
      h("div", { className: "message-stack" }, [
        h("div", { className: "message-head message-head-user" }, [
          h("span", { className: "message-name" }, [escapeHtml(userName)]),
          h("span", { className: "message-role" }, ["成员"]),
          MessageTime({ timestamp }),
          onCopy ? h("div", { className: "message-actions" }, [
            CopyButton({ onCopy })
          ]) : null
        ]),
        h("div", { className: "message-bubble" }, [
          escapeHtml(content)
        ])
      ])
    ]
  );
}

/**
 * Assistant message card
 * @param {Object} props
 * @param {string} props.name - Assistant name
 * @param {string} props.provider - Model provider
 * @param {string} props.model - Model ID
 * @param {string} props.content - Message content
 * @param {string} props.thinking - Thinking content (optional)
 * @param {Date} props.timestamp - Message time
 * @param {boolean} props.isLoading - Loading state
 * @param {string} props.avatar - Avatar URL
 * @returns {HTMLElement}
 */
export function AssistantMessageCard({
  name,
  provider,
  model,
  content,
  thinking,
  timestamp,
  isLoading = false,
  avatar,
  onCopy,
  messageId = ""
}) {
  return h(
    "div",
    { className: "message-row assistant", dataset: { messageid: messageId } },
    [
      Avatar({ name, avatar, variant: "assistant" }),
      h("div", { className: "message-stack" }, [
        MessageHeader({
          name,
          role: isLoading ? "生成中" : "AI 群友",
          timestamp,
          isLoading,
          onCopy
        }),
        MessageBubble({ content, thinking, isLoading, messageId })
      ])
    ]
  );
}

/**
 * Synthesis message card - special styling for merged answers
 * @param {Object} props
 * @param {string} props.name - Synthesis friend name
 * @param {string} props.content - Synthesized content
 * @param {Date} props.timestamp - Message time
 * @param {string} props.avatar - Avatar URL
 * @param {string} props.synthesisLabel - Label text
 * @returns {HTMLElement}
 */
export function SynthesisMessageCard({
  name,
  content,
  timestamp,
  avatar,
  synthesisLabel = "整合",
  onCopy,
  messageId = ""
}) {
  return h(
    "div",
    { className: "message-row assistant synthesis-row", dataset: { messageid: messageId } },
    [
      Avatar({ name, avatar, variant: "synthesis" }),
      h("div", { className: "message-stack" }, [
        MessageHeader({
          name,
          role: "整合结果",
          timestamp,
          isSynthesis: true,
          synthesisLabel,
          onCopy
        }),
        MessageBubble({ content, isSynthesis: true, messageId })
      ])
    ]
  );
}

// ============================================================================
// High-Level Composables
// ============================================================================

/**
 * Message card factory - creates appropriate card based on message type
 * @param {Object} message - Message data
 * @param {Object} options - Rendering options
 * @returns {HTMLElement}
 */
export function MessageCard(message, options = {}) {
  const {
    userName = "我",
    synthesisLabel = "整合",
    currentLanguage = "zh-CN",
    onCopy
  } = options;

  const messageId = message.messageId || "";

  // User message
  if (message.kind === "user") {
    return UserMessageCard({
      content: message.content,
      timestamp: message.createdAt,
      userName: currentLanguage === "zh-CN" ? "我" : "You",
      onCopy
    });
  }

  // Synthesis message
  if (message.kind === "synthesis") {
    return SynthesisMessageCard({
      name: message.name,
      content: message.content,
      timestamp: message.createdAt,
      avatar: message.avatar,
      synthesisLabel,
      onCopy,
      messageId
    });
  }

  // Assistant message (default)
  return AssistantMessageCard({
    name: message.name,
    provider: message.provider,
    model: message.model,
    content: message.content,
    thinking: message.thinking,
    timestamp: message.createdAt,
    isLoading: message.isLoading,
    avatar: message.avatar,
    onCopy,
    messageId
  });
}

// ============================================================================
// Render Utilities
// ============================================================================

/**
 * Render multiple messages to a container
 * @param {HTMLElement} container - Target container
 * @param {Object[]} messages - Array of message objects
 * @param {Object} options - Rendering options
 */
export function renderMessages(container, messages, options = {}) {
  container.innerHTML = "";

  const fragment = document.createDocumentFragment();

  messages.forEach((message) => {
    const card = MessageCard(message, options);
    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}

/**
 * Append a single message to a container
 * @param {HTMLElement} container - Target container
 * @param {Object} message - Message object
 * @param {Object} options - Rendering options
 * @returns {HTMLElement} - The created card element
 */
export function appendMessage(container, message, options = {}) {
  const card = MessageCard(message, options);
  container.appendChild(card);
  return card;
}

/**
 * Update an existing message card
 * @param {HTMLElement} card - Existing card element
 * @param {Object} updates - Updated message data
 * @param {Object} options - Rendering options
 */
export function updateMessage(card, updates, options = {}) {
  const newCard = MessageCard(updates, options);
  card.replaceWith(newCard);
  return newCard;
}

// Export all components as a namespace
export const Components = {
  h,
  escapeHtml,
  Avatar,
  ProviderIcon,
  MessageTime,
  RoleBadge,
  SynthesisBadge,
  CopyIcon,
  CheckIcon,
  CopyButton,
  MessageHeader,
  SkeletonLoader,
  ThinkingBlock,
  MessageContent,
  MessageBubble,
  UserMessageCard,
  AssistantMessageCard,
  SynthesisMessageCard,
  MessageCard,
  renderMessages,
  appendMessage,
  updateMessage
};
