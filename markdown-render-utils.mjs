function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function isSafeUrl(value) {
  if (!value || /\s/.test(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function renderInline(text) {
  const placeholders = [];

  const store = (html) => {
    const token = `\u0000${placeholders.length}\u0000`;
    placeholders.push(html);
    return token;
  };

  let output = escapeHtml(text);

  output = output.replace(/`([^`]+)`/g, (_, code) => store(`<code>${code}</code>`));

  output = replaceMarkdownLinks(output, store);

  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  output = output.replace(/ {2,}\n/g, "<br>");
  output = output.replaceAll("\n", "<br>");

  return output.replace(/\u0000(\d+)\u0000/g, (_, index) => placeholders[Number(index)]);
}

function replaceMarkdownLinks(text, store) {
  let output = "";
  let index = 0;

  while (index < text.length) {
    const labelStart = text.indexOf("[", index);
    if (labelStart === -1) {
      output += text.slice(index);
      break;
    }

    output += text.slice(index, labelStart);
    const labelEnd = text.indexOf("]", labelStart + 1);
    if (labelEnd === -1 || text[labelEnd + 1] !== "(") {
      output += text[labelStart];
      index = labelStart + 1;
      continue;
    }

    let hrefEnd = labelEnd + 2;
    let depth = 1;

    while (hrefEnd < text.length && depth > 0) {
      const char = text[hrefEnd];
      if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        depth -= 1;
      }
      hrefEnd += 1;
    }

    if (depth !== 0) {
      output += text.slice(labelStart);
      break;
    }

    const label = text.slice(labelStart + 1, labelEnd);
    const href = text.slice(labelEnd + 2, hrefEnd - 1);

    if (!isSafeUrl(href)) {
      output += store(label);
    } else {
      output += store(
        `<a href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`
      );
    }

    index = hrefEnd;
  }

  return output;
}

function renderParagraph(lines) {
  return `<p>${renderInline(lines.join("\n"))}</p>`;
}

function renderBlockquote(lines) {
  const normalized = lines.map((line) => line.replace(/^>\s?/, ""));
  return `<blockquote>${renderParagraph(normalized)}</blockquote>`;
}

function renderList(lines, ordered) {
  const tag = ordered ? "ol" : "ul";
  const pattern = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
  const items = lines.map((line) => `<li>${renderInline(line.replace(pattern, ""))}</li>`).join("");
  return `<${tag}>${items}</${tag}>`;
}

function renderFence(lines, startIndex) {
  const match = lines[startIndex].match(/^```\s*([A-Za-z0-9_-]+)?\s*$/);
  const language = match?.[1] || "";
  const content = [];
  let index = startIndex + 1;

  while (index < lines.length && !/^```\s*$/.test(lines[index])) {
    content.push(lines[index]);
    index += 1;
  }

  const className = language ? ` class="language-${escapeAttribute(language)}"` : "";
  return {
    html: `<pre><code${className}>${escapeHtml(content.join("\n"))}</code></pre>`,
    nextIndex: index < lines.length ? index + 1 : index
  };
}

export function renderSafeMarkdown(markdown) {
  const source = String(markdown ?? "").replace(/\r\n?/g, "\n");

  if (!source.trim()) {
    return "";
  }

  const lines = source.split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^```/.test(line)) {
      const fence = renderFence(lines, index);
      blocks.push(fence.html);
      index = fence.nextIndex;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push(`<h${headingMatch[1].length}>${renderInline(headingMatch[2])}</h${headingMatch[1].length}>`);
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index]);
        index += 1;
      }
      blocks.push(renderBlockquote(quoteLines));
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const listLines = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        listLines.push(lines[index]);
        index += 1;
      }
      blocks.push(renderList(listLines, false));
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const listLines = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        listLines.push(lines[index]);
        index += 1;
      }
      blocks.push(renderList(listLines, true));
      continue;
    }

    const paragraphLines = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^```/.test(lines[index]) &&
      !/^(#{1,6})\s+/.test(lines[index]) &&
      !/^>\s?/.test(lines[index]) &&
      !/^[-*]\s+/.test(lines[index]) &&
      !/^\d+\.\s+/.test(lines[index])
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    blocks.push(renderParagraph(paragraphLines));
  }

  return blocks.join("");
}
