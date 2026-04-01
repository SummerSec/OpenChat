import { useEffect, useCallback, useState, useRef } from 'react';
import { streamText, type CoreMessage } from 'ai';
import type { Friend } from '../types/chat';
import { useChatStore } from '../stores/chatStore';
import { hasLiveProviderConfig, createModelInstance } from '../lib/ai-sdk-adapters';

interface UseFriendChatOptions {
  friend: Friend;
  prompt: string;
  enabled: boolean;
}

interface UseFriendChatReturn {
  isLoading: boolean;
  error: Error | undefined;
  stop: () => void;
  isMock: boolean;
}

export function useFriendChat({ friend, prompt, enabled }: UseFriendChatOptions): UseFriendChatReturn {
  const {
    updateFriendStreaming,
    setFriendDone,
    groupSettings
  } = useChatStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);

  const systemPrompt = groupSettings?.sharedSystemPromptEnabled
    ? groupSettings.sharedSystemPrompt
    : friend.systemPrompt || '';

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled || !prompt || !hasLiveProviderConfig(friend)) {
      return;
    }

    setIsLoading(true);
    setError(undefined);

    const messages: CoreMessage[] = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      { role: 'user' as const, content: prompt },
    ];

    const model = createModelInstance(friend);
    abortControllerRef.current = new AbortController();

    let fullContent = '';
    let fullThinking = '';
    let isAborted = false;

    const runStream = async () => {
      try {
        const result = streamText({
          model,
          messages,
          abortSignal: abortControllerRef.current?.signal,
        });

        for await (const part of result.fullStream) {
          if (part.type === 'text-delta') {
            fullContent += part.text;
            updateFriendStreaming(friend.id, fullContent, fullThinking);
          } else if (part.type === 'reasoning-delta') {
            fullThinking += part.text;
            updateFriendStreaming(friend.id, fullContent, fullThinking);
          }
        }

        if (!isAborted) {
          setFriendDone(friend.id, fullContent, fullThinking);
        }
      } catch (err: unknown) {
        if ((err as Error).name === 'AbortError') {
          isAborted = true;
          return;
        }
        const error = err as Error;
        const { currentLanguage } = useChatStore.getState();
        const fallbackContent = currentLanguage === 'zh-CN'
          ? `抱歉，${friend.name} 暂时无法回复：${error.message}`
          : `Sorry, ${friend.name} is temporarily unavailable: ${error.message}`;
        setFriendDone(friend.id, fallbackContent, '', error.message);
        setError(error);
      } finally {
        setIsLoading(false);
      }
    };

    runStream();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [enabled, prompt, friend.id, friend.name, systemPrompt, updateFriendStreaming, setFriendDone]);

  return {
    isLoading,
    error,
    stop,
    isMock: !hasLiveProviderConfig(friend),
  };
}
