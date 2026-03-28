import test from "node:test";
import assert from "node:assert/strict";

import { renderSafeMarkdown } from "./markdown-render-utils.mjs";

test("renders headings emphasis inline code and links", () => {
  const html = renderSafeMarkdown("# Title\n\nA **bold** and *italic* line with `code` and [docs](https://example.com).", {
    linkLabelPrefix: ""
  });

  assert.equal(
    html,
    "<h1>Title</h1><p>A <strong>bold</strong> and <em>italic</em> line with <code>code</code> and <a href=\"https://example.com\" target=\"_blank\" rel=\"noopener noreferrer\">docs</a>.</p>"
  );
});

test("renders unordered lists ordered lists and blockquotes", () => {
  const html = renderSafeMarkdown(
    "- one\n- two\n\n1. first\n2. second\n\n> quoted\n> text"
  );

  assert.equal(
    html,
    "<ul><li>one</li><li>two</li></ul><ol><li>first</li><li>second</li></ol><blockquote><p>quoted<br>text</p></blockquote>"
  );
});

test("renders fenced code blocks without parsing markdown inside", () => {
  const html = renderSafeMarkdown("```js\nconst x = 1 < 2;\n**not bold**\n```", {
    linkLabelPrefix: ""
  });

  assert.equal(
    html,
    "<pre><code class=\"language-js\">const x = 1 &lt; 2;\n**not bold**</code></pre>"
  );
});

test("escapes raw html and preserves hard line breaks", () => {
  const html = renderSafeMarkdown("Line one  \nLine <b>two</b>");

  assert.equal(html, "<p>Line one<br>Line &lt;b&gt;two&lt;/b&gt;</p>");
});

test("suppresses unsafe and malformed links to plain text labels", () => {
  const javascriptLink = renderSafeMarkdown("Read [this](javascript:alert(1)) now.", {
    linkLabelPrefix: ""
  });
  const malformedLink = renderSafeMarkdown("Use [broken](notaurl) safely.", {
    linkLabelPrefix: ""
  });
  const unclosedLink = renderSafeMarkdown("Bad [link](https://example.com", {
    linkLabelPrefix: ""
  });
  const unclosedLinkWithTrailingText = renderSafeMarkdown("Bad [link](https://example.com trailing text", {
    linkLabelPrefix: ""
  });

  assert.equal(javascriptLink, "<p>Read this now.</p>");
  assert.equal(malformedLink, "<p>Use broken safely.</p>");
  assert.equal(unclosedLink, "<p>Bad link</p>");
  assert.equal(unclosedLinkWithTrailingText, "<p>Bad link trailing text</p>");
});

test("preserves punctuation after an unclosed link", () => {
  const html = renderSafeMarkdown("Bad [link](https://example.com.", {
    linkLabelPrefix: ""
  });

  assert.equal(html, "<p>Bad link.</p>");
});

test("preserves punctuation and later text after an unclosed link", () => {
  const html = renderSafeMarkdown("Bad [link](https://example.com(foo), then more", {
    linkLabelPrefix: ""
  });

  assert.equal(html, "<p>Bad link, then more</p>");
});

test("continues parsing later valid markdown after an unclosed link", () => {
  const html = renderSafeMarkdown(
    "Bad [link](https://example.com and [docs](https://example.org) with **bold** text",
    {
      linkLabelPrefix: ""
    }
  );

  assert.equal(
    html,
    "<p>Bad link and <a href=\"https://example.org\" target=\"_blank\" rel=\"noopener noreferrer\">docs</a> with <strong>bold</strong> text</p>"
  );
});
