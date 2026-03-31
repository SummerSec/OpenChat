import React from "react";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { cjk } from "@streamdown/cjk";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import "katex/dist/katex.min.css";
import "streamdown/styles.css";

const plugins = { code, cjk, math, mermaid };

export default function AssistantMarkdown({ content = "", isLoading = false }) {
  return (
    <Streamdown
      plugins={plugins}
      isAnimating={isLoading}
    >
      {String(content || "")}
    </Streamdown>
  );
}
