// src/lib/ai-sdk-adapters.ts
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { Friend } from "../types/chat";

export type ProviderKind = "anthropic" | "google" | "openai-compatible";

export function detectProviderKind(friend: Friend): ProviderKind {
  const provider = String(friend.provider || "").toLowerCase();
  const name = String(friend.name || "").toLowerCase();

  if (provider.includes("anthropic") || name.includes("claude")) {
    return "anthropic";
  }
  if (provider.includes("google") || name.includes("gemini")) {
    return "google";
  }
  return "openai-compatible";
}

export function hasLiveProviderConfig(friend: Friend): boolean {
  return Boolean(
    String(friend.baseUrl || "").trim() &&
    String(friend.apiKey || "").trim(),
  );
}

// Use type assertion to handle version differences between LanguageModelV1 and LanguageModelV3
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createModelInstance(friend: Friend): any {
  const providerKind = detectProviderKind(friend);
  const baseUrl = String(friend.baseUrl || "").replace(/\/+$/, "");
  const apiKey = friend.apiKey;
  const modelId = friend.model;

  switch (providerKind) {
    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey,
        baseURL: baseUrl,
      });
      return anthropic(modelId, {
        ...(friend.thinkingEnabled
          ? { thinking: { type: "enabled", budgetTokens: 1024 } }
          : {}),
      });
    }

    case "google": {
      const google = createGoogleGenerativeAI({
        apiKey,
        baseURL: baseUrl,
      });
      return google(modelId);
    }

    default: {
      // OpenAI-compatible providers (OpenAI, xAI, DeepSeek, etc.)
      const openai = createOpenAI({
        apiKey,
        baseURL: baseUrl,
        compatibility: "compatible",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      return openai(modelId, {
        ...(friend.thinkingEnabled ? { reasoningEffort: "medium" } : {}),
      });
    }
  }
}
