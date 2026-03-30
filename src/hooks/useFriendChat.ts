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

        const response = result.toDataStreamResponse({ sendReasoning: true });
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Failed to get stream reader');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine.startsWith('data: ')) continue;

              const data = trimmedLine.slice(6).trim();
              if (!data || data === '[DONE]') continue;

              // Parse Vercel AI SDK data stream format
              // "0:" prefix for content, "1:" prefix for thinking
              if (data.startsWith('"0:')) {
                try {
                  const text = JSON.parse(data.slice(1));
                  fullContent += text;
                  updateFriendStreaming(friend.id, fullContent, fullThinking);
                } catch {
                  // ignore parse errors
                }
              } else if (data.startsWith('"1:')) {
                try {
                  const text = JSON.parse(data.slice(1));
                  fullThinking += text;
                  updateFriendStreaming(friend.id, fullContent, fullThinking);
                } catch {
                  // ignore parse errors
                }
              }
            }
          }

          // Process remaining buffer
          if (buffer.trim()) {
            const trimmedLine = buffer.trim();
            if (trimmedLine.startsWith('data: ')) {
              const data = trimmedLine.slice(6).trim();
              if (data.startsWith('"0:')) {
                try {
                  const text = JSON.parse(data.slice(1));
                  fullContent += text;
                } catch {
                  // ignore
                }
              } else if (data.startsWith('"1:')) {
                try {
                  const text = JSON.parse(data.slice(1));
                  fullThinking += text;
                } catch {
                  // ignore
                }
              }
            }
          }

          if (!isAborted) {
            setFriendDone(friend.id, fullContent, fullThinking);
          }
        } finally {
          reader.releaseLock();
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
