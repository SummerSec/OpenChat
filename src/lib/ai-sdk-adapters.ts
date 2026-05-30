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

// Optional CORS proxy for frontend mode. Configured in Settings and stored
// in localStorage. Supports a `{url}` template (query-style proxies) or a
// plain prefix (e.g. cors-anywhere style: "https://proxy/" + target URL).
export function buildProxiedFetch(): typeof fetch | undefined {
  let proxy = "";
  try {
    proxy = (localStorage.getItem("openchat-cors-proxy") || "").trim();
  } catch {
    proxy = "";
  }
  if (!proxy) return undefined;
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const target = proxy.includes("{url}")
      ? proxy.replace("{url}", encodeURIComponent(rawUrl))
      : proxy + rawUrl;
    if (typeof input === "string" || input instanceof URL) {
      return fetch(target, init);
    }
    return fetch(new Request(target, input as Request));
  }) as typeof fetch;
}

// Use type assertion to handle version differences between LanguageModelV1 and LanguageModelV3
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createModelInstance(friend: Friend): any {
  const providerKind = detectProviderKind(friend);
  const baseUrl = String(friend.baseUrl || "").replace(/\/+$/, "");
  const apiKey = friend.apiKey;
  const modelId = friend.model;
  const proxiedFetch = buildProxiedFetch();
  const fetchOpt = proxiedFetch ? { fetch: proxiedFetch } : {};

  switch (providerKind) {
    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey,
        baseURL: baseUrl,
        ...fetchOpt,
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
        ...fetchOpt,
      });
      return google(modelId);
    }

    default: {
      // OpenAI-compatible providers (OpenAI, xAI, DeepSeek, etc.)
      const openai = createOpenAI({
        apiKey,
        baseURL: baseUrl,
        compatibility: "compatible",
        ...fetchOpt,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      return openai(modelId, {
        ...(friend.thinkingEnabled ? { reasoningEffort: "medium" } : {}),
      });
    }
  }
}
