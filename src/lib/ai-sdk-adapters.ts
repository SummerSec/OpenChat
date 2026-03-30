// src/lib/ai-sdk-adapters.ts
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { Friend, ProviderKind } from '../types/chat';
import type { LanguageModel } from 'ai';

export { type ProviderKind };

export function detectProviderKind(friend: Friend): ProviderKind {
  const provider = String(friend.provider || '').toLowerCase();
  const name = String(friend.name || '').toLowerCase();

  if (provider.includes('anthropic') || name.includes('claude')) {
    return 'anthropic';
  }
  if (provider.includes('google') || name.includes('gemini')) {
    return 'google';
  }
  return 'openai-compatible';
}

export function hasLiveProviderConfig(friend: Friend): boolean {
  return Boolean(
    String(friend.baseUrl || '').trim() &&
    String(friend.apiKey || '').trim()
  );
}

export function createModelInstance(friend: Friend): LanguageModel {
  const providerKind = detectProviderKind(friend);
  const baseUrl = String(friend.baseUrl || '').replace(/\/+$/, '');
  const apiKey = friend.apiKey;
  const modelId = friend.model;

  switch (providerKind) {
    case 'anthropic':
      return createAnthropic({
        apiKey,
        baseURL: baseUrl,
      })(modelId, {
        ...(friend.thinkingEnabled ? { thinking: { type: 'enabled', budget_tokens: 1024 } } : {}),
      });

    case 'google':
      return createGoogleGenerativeAI({
        apiKey,
        baseURL: baseUrl,
      })(modelId);

    default:
      // OpenAI-compatible providers (OpenAI, xAI, DeepSeek, etc.)
      return createOpenAI({
        apiKey,
        baseURL: baseUrl,
        compatibility: 'compatible',
      })(modelId, {
        ...(friend.thinkingEnabled ? { reasoning_effort: 'medium' } : {}),
      });
  }
}
