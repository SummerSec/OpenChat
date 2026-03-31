/**
 * 原生打字机流式效果 - 极致简单
 * 不依赖 React，直接操作 DOM
 */

const typewriterCache = new Map();

/**
 * 将文本逐步显示到目标元素
 * @param {HTMLElement} element - 目标 DOM 元素
 * @param {string} text - 完整文本
 * @param {object} options - 配置选项
 */
export function typewriteToElement(element, text, options = {}) {
  const { chunkSize = 3, delay = 8, onUpdate } = options;

  // 停止之前的打字效果
  stopTypewriter(element);

  let index = 0;
  let currentHTML = "";

  function typeNextChunk() {
    if (index >= text.length) {
      typewriterCache.delete(element);
      if (onUpdate) onUpdate(text, true);
      return;
    }

    // 添加下一个 chunk
    const chunk = text.slice(index, index + chunkSize);
    currentHTML += chunk;
    index += chunk.length;

    // 渲染当前内容（带简单 Markdown 处理）
    element.innerHTML = renderMarkdown(currentHTML);
    element.dataset.content = currentHTML;

    // 滚动到底部
    scrollToBottom();

    // 继续下一个 chunk
    const timeoutId = setTimeout(typeNextChunk, delay);
    typewriterCache.set(element, timeoutId);

    if (onUpdate) onUpdate(currentHTML, false);
  }

  // 开始打字
  typeNextChunk();
}

/**
 * 停止元素的打字效果
 */
export function stopTypewriter(element) {
  const timeoutId = typewriterCache.get(element);
  if (timeoutId) {
    clearTimeout(timeoutId);
    typewriterCache.delete(element);
  }
}

/**
 * 简单的 Markdown 渲染（支持代码块、加粗、斜体）
 */
function renderMarkdown(text) {
  if (!text) return "";

  let html = escapeHtml(text);

  // 代码块
  html = html.replace(/```(\w+)?\n([\s\S]*?)(?:```|$)/g, (match, lang, code) => {
    const langClass = lang ? `language-${lang}` : "";
    return `<pre><code class="${langClass}">${code}</code></pre>`;
  });

  // 行内代码
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 加粗
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");

  // 斜体
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");

  // 换行
  html = html.replace(/\n/g, "<br>");

  return html;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function scrollToBottom() {
  const messageStream = document.getElementById("message-stream");
  if (messageStream) {
    requestAnimationFrame(() => {
      messageStream.scrollTop = messageStream.scrollHeight;
    });
  }
}

/**
 * 更新消息内容（流式或立即）
 * @param {string} messageId - 消息 ID
 * @param {string} content - 新内容
 * @param {boolean} animate - 是否动画
 * @param {boolean} incremental - 是否增量更新（只在animate=false时有效）
 */
export async function updateMessageStream(messageId, content, animate = true, incremental = false) {
  console.debug("[StreamRenderer] updateMessageStream called for:", messageId, "content length:", content.length);

  // 查找目标元素，兼容 data-messageid 和 data-message-id 两种命名
  function findTarget(id) {
    return document.querySelector(`[data-messageid="${id}"] .streamdown-target`)
      || document.querySelector(`.streamdown-target[data-messageid="${id}"]`)
      || document.querySelector(`[data-message-id="${id}"] .streamdown-target`)
      || document.querySelector(`.streamdown-target[data-message-id="${id}"]`);
  }

  let element = null;
  let retries = 5;

  while (retries > 0 && !element) {
    element = findTarget(messageId);
    if (!element) {
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }

  if (!element) {
    // 回退：messageStream 中最后一个 .streamdown-target
    const messageStream = document.getElementById("message-stream");
    if (messageStream) {
      const allTargets = messageStream.querySelectorAll(".streamdown-target");
      if (allTargets.length > 0) {
        element = allTargets[allTargets.length - 1];
      }
    }

    if (!element) {
      return false;
    }
  }

  console.debug("[StreamRenderer] updateMessageStream called:", {
    messageId,
    contentLength: content.length,
    contentPreview: content.substring(0, 50) + (content.length > 50 ? "..." : ""),
    animate,
    incremental,
    currentContent: element.dataset.content || "(empty)",
    currentContentLength: (element.dataset.content || "").length
  });

  if (animate) {
    console.debug("[StreamRenderer] Starting typewriter animation");
    typewriteToElement(element, content);
  } else {
    stopTypewriter(element);
    const currentContent = element.dataset.content || "";
    console.debug("[StreamRenderer] Checking incremental update:", {
      currentContentLength: currentContent.length,
      startsWithMatch: content.startsWith(currentContent),
      contentStartsWith: content.substring(0, Math.min(20, content.length))
    });

    if (incremental && content.startsWith(currentContent)) {
      // 增量更新：只添加新内容
      const newText = content.slice(currentContent.length);
      console.debug("[StreamRenderer] Incremental update:", {
        newTextLength: newText.length,
        newTextPreview: newText.substring(0, 30) + (newText.length > 30 ? "..." : "")
      });

      if (newText) {
        // 将新内容逐步添加到现有内容中
        console.debug("[StreamRenderer] Starting appendWithAnimation");
        appendWithAnimation(element, currentContent, newText);
      } else {
        // 内容没有变化，直接更新
        console.debug("[StreamRenderer] No new text, updating fully");
        element.innerHTML = renderMarkdown(content);
        element.dataset.content = content;
      }
    } else {
      // 非增量或内容不匹配，完全替换
      console.debug("[StreamRenderer] Full replacement (not incremental or content mismatch)");
      element.innerHTML = renderMarkdown(content);
      element.dataset.content = content;
    }
  }

  return true;
}

/**
 * 将新文本以动画方式追加到元素
 */
function appendWithAnimation(element, baseContent, newText) {
  const chunkSize = 3;
  const delay = 8;
  let index = 0;

  function appendNextChunk() {
    if (index >= newText.length) {
      // 动画完成时确保最终内容已渲染
      const finalContent = baseContent + newText;
      element.innerHTML = renderMarkdown(finalContent);
      element.dataset.content = finalContent;
      scrollToBottom();
      return;
    }

    const chunk = newText.slice(index, index + chunkSize);
    const newContent = baseContent + newText.slice(0, index + chunk.length);
    const newHTML = renderMarkdown(newContent);
    element.innerHTML = newHTML;
    element.dataset.content = newContent;
    index += chunk.length;

    requestAnimationFrame(() => {
      scrollToBottom();
      setTimeout(appendNextChunk, delay);
    });
  }

  appendNextChunk();
}
