import { streamText, generateText } from "ai";
import { createModelInstance } from "../lib/ai-sdk-adapters";
import { extractThinkBlocks } from "./thinking-config-utils.mjs";

/**
 * Unified streaming call for all providers via Vercel AI SDK.
 * Replaces callOpenAICompatibleFrontendStream, callAnthropicFrontendStream,
 * callGeminiFrontend, etc. with a single code path.
 *
 * @param {Object} model - model/friend object with provider, model, baseUrl, apiKey, thinkingEnabled
 * @param {string} prompt - user message
 * @param {string} systemPrompt - system prompt
 * @param {Object} options - { history, onDelta, thinkingEnabled, abortSignal }
 * @returns {Promise<{content: string, thinking: string}>}
 */
export async function callFrontendStream(model, prompt, systemPrompt = "", options = {}) {
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  if (Array.isArray(options.history) && options.history.length > 0) {
    messages.push(...options.history);
  }
  messages.push({ role: "user", content: prompt });

  const aiModel = createModelInstance(model);
  const result = streamText({
    model: aiModel,
    messages,
    maxTokens: 4096,
    abortSignal: options.abortSignal,
  });

  let fullContent = "";
  let fullThinking = "";
  let insideThinkTag = false;

  for await (const part of result.fullStream) {
    if (part.type === "reasoning-delta") {
      fullThinking += part.text;
      options.onDelta?.({ type: "thinking", text: part.text });
    } else if (part.type === "text-delta") {
      // Handle <think> tags embedded in content (e.g. MiniMax, DeepSeek)
      let text = part.text;
      while (text.length > 0) {
        if (insideThinkTag) {
          const closeIdx = text.indexOf("</think>");
          if (closeIdx !== -1) {
            const thinkPart = text.slice(0, closeIdx);
            if (thinkPart) {
              fullThinking += thinkPart;
              options.onDelta?.({ type: "thinking", text: thinkPart });
            }
            insideThinkTag = false;
            text = text.slice(closeIdx + 8);
          } else {
            fullThinking += text;
            options.onDelta?.({ type: "thinking", text });
            text = "";
          }
        } else {
          const openIdx = text.indexOf("<think>");
          if (openIdx !== -1) {
            const contentPart = text.slice(0, openIdx);
            if (contentPart) {
              fullContent += contentPart;
              options.onDelta?.({ type: "content", text: contentPart });
            }
            insideThinkTag = true;
            text = text.slice(openIdx + 7);
          } else {
            fullContent += text;
            options.onDelta?.({ type: "content", text });
            text = "";
          }
        }
      }
    }
  }

  // Post-process: if <think> tags were split across chunks, re-extract
  let finalContent = fullContent.trim();
  let finalThinking = fullThinking.trim();
  if (!finalThinking && finalContent.includes("<think>")) {
    const extracted = extractThinkBlocks(finalContent);
    finalContent = extracted.content;
    finalThinking = extracted.thinking;
  }

  return { content: finalContent, thinking: finalThinking };
}

/**
 * Non-streaming generate call for model connection testing.
 *
 * @param {Object} model - model/friend object with provider, model, baseUrl, apiKey, thinkingEnabled
 * @param {string} prompt - user message
 * @param {string} systemPrompt - system prompt
 * @returns {Promise<{content: string, thinking: string}>}
 */
export async function callFrontendGenerate(model, prompt, systemPrompt = "") {
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const aiModel = createModelInstance(model);
  const result = await generateText({
    model: aiModel,
    messages,
    maxTokens: 1200,
  });

  let content = result.text || "";
  let thinking = result.reasoningText || "";

  const extracted = extractThinkBlocks(content);
  if (extracted.thinking) {
    thinking = thinking ? `${thinking}\n\n${extracted.thinking}` : extracted.thinking;
    content = extracted.content;
  }

  return { content: content.trim(), thinking: thinking.trim() };
}
