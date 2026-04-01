import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { streamText, type CoreMessage } from 'ai';
import type { Friend, FriendStreamState } from '../types/chat';
import { useChatStore } from '../stores/chatStore';
import { createModelInstance } from '../lib/ai-sdk-adapters';

interface UseSynthesisChatOptions {
  synthesisFriend: Friend | null;
  friendStates: Record<string, FriendStreamState>;
  userPrompt: string | null;
  enabled: boolean;
}

interface UseSynthesisChatReturn {
  isLoading: boolean;
  error: Error | undefined;
  stop: () => void;
}

export function useSynthesisChat({
  synthesisFriend,
  friendStates,
  userPrompt,
  enabled,
}: UseSynthesisChatOptions): UseSynthesisChatReturn {
  const { updateSynthesisStreaming, setSynthesisDone, currentLanguage } = useChatStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);

  const messages = useMemo((): CoreMessage[] => {
    if (!userPrompt) return [];
    const systemPrompt = currentLanguage === 'zh-CN'
      ? '你负责整合多位 AI 群友的输出。请总结大家的观点，指出共识和分歧，给出综合性的建议。'
      : 'You are responsible for synthesizing multiple AI friend outputs. Summarize their views, identify consensus and disagreements, and provide comprehensive recommendations.';
    const synthesisMessages = Object.values(friendStates)
      .filter(state => state.isDone && state.content)
      .map(state => ({
        role: 'assistant' as const,
        content: `[${state.friendId}]\n${state.content}`,
      }));

    if (synthesisMessages.length === 0) return [];

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
      { role: 'user', content: `群友回复:\n${synthesisMessages.map(m => m.content).join('\n\n---\n\n')}` },
    ];
  }, [userPrompt, friendStates, currentLanguage]);

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled || !synthesisFriend || messages.length === 0) {
      return;
    }

    setIsLoading(true);
    setError(undefined);

    abortControllerRef.current = new AbortController();

    let fullContent = '';
    let isAborted = false;

    const runStream = async () => {
      try {
        const model = createModelInstance(synthesisFriend);
        const result = streamText({
          model,
          messages,
          abortSignal: abortControllerRef.current?.signal,
        });

        for await (const part of result.fullStream) {
          if (part.type === 'text-delta') {
            fullContent += part.text;
            updateSynthesisStreaming(fullContent);
          }
        }

        if (!isAborted) {
          setSynthesisDone(fullContent);
        }
      } catch (err: unknown) {
        if ((err as Error).name === 'AbortError') {
          isAborted = true;
          return;
        }
        const error = err as Error;
        const friendContents = Object.values(useChatStore.getState().friendStates)
          .filter(s => s.isDone).map(s => s.content);
        const fallbackContent = currentLanguage === 'zh-CN'
          ? `整合失败：${error.message}\n\n群友回复摘要：\n${friendContents.join('\n\n')}`
          : `Synthesis failed: ${error.message}\n\nFriend responses:\n${friendContents.join('\n\n')}`;
        setSynthesisDone(fallbackContent);
        setError(error);
      } finally {
        setIsLoading(false);
      }
    };

    runStream();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [enabled, synthesisFriend, messages, currentLanguage, updateSynthesisStreaming, setSynthesisDone]);

  return {
    isLoading,
    error,
    stop,
  };
}
