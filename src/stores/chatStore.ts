// src/stores/chatStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Friend, Model, GroupSettings, FriendStreamState, SynthesisStreamState } from '../types/chat';

interface ChatStore {
  // Data from localStorage
  friends: Friend[];
  models: Model[];
  groupSettings: GroupSettings | null;
  currentLanguage: string;

  // Runtime state
  isSubmitting: boolean;
  activePrompt: string | null;
  friendStates: Record<string, FriendStreamState>;
  synthesisState: SynthesisStreamState;
  shouldStartSynthesis: boolean;
  activeConversationId: string | null;

  // Actions
  loadFromStorage: () => void;
  setActivePrompt: (prompt: string | null) => void;
  startSubmission: (prompt: string) => void;
  initFriendStates: (friendIds: string[]) => void;
  updateFriendStreaming: (friendId: string, content: string, thinking?: string) => void;
  setFriendDone: (friendId: string, content: string, thinking?: string, error?: string) => void;
  checkAllFriendsDone: () => boolean;
  startSynthesis: () => void;
  updateSynthesisStreaming: (content: string) => void;
  setSynthesisDone: (content: string) => void;
  endSubmission: () => void;
  reset: () => void;
}

const STORAGE_KEYS = {
  friends: 'openchat-friend-profiles',
  models: 'multiplechat-model-configs',
  groupSettings: 'openchat-default-group-settings',
  language: 'multiplechat-language',
};

const initialSynthesisState: SynthesisStreamState = {
  isStreaming: false,
  isDone: false,
  content: '',
};

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      // Initial state
      friends: [],
      models: [],
      groupSettings: null,
      currentLanguage: 'zh-CN',
      isSubmitting: false,
      activePrompt: null,
      friendStates: {},
      synthesisState: initialSynthesisState,
      shouldStartSynthesis: false,
      activeConversationId: null,

      // Load data from existing localStorage keys
      loadFromStorage: () => {
        try {
          const friends = JSON.parse(localStorage.getItem(STORAGE_KEYS.friends) || '[]');
          const models = JSON.parse(localStorage.getItem(STORAGE_KEYS.models) || '[]');
          const groupSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.groupSettings) || 'null');
          const currentLanguage = localStorage.getItem(STORAGE_KEYS.language) || 'zh-CN';

          set({ friends, models, groupSettings, currentLanguage });
        } catch (e) {
          console.error('Failed to load from localStorage:', e);
        }
      },

      setActivePrompt: (prompt) => set({ activePrompt: prompt }),

      startSubmission: (prompt) => set({
        isSubmitting: true,
        activePrompt: prompt,
        friendStates: {},
        synthesisState: initialSynthesisState,
        shouldStartSynthesis: false,
      }),

      initFriendStates: (friendIds) => {
        const states: Record<string, FriendStreamState> = {};
        friendIds.forEach(id => {
          states[id] = {
            friendId: id,
            isStreaming: true,
            isDone: false,
            content: '',
            thinking: '',
          };
        });
        set({ friendStates: states });
      },

      updateFriendStreaming: (friendId, content, thinking = '') => set((state) => ({
        friendStates: {
          ...state.friendStates,
          [friendId]: {
            ...state.friendStates[friendId],
            content,
            thinking,
            isStreaming: true,
          },
        },
      })),

      setFriendDone: (friendId, content, thinking = '', error) => set((state) => {
        const newStates = {
          ...state.friendStates,
          [friendId]: {
            ...state.friendStates[friendId],
            content,
            thinking,
            isStreaming: false,
            isDone: true,
            error,
          },
        };

        // Check if all friends are done
        const allDone = Object.values(newStates).every(s => s.isDone);

        return {
          friendStates: newStates,
          shouldStartSynthesis: allDone,
        };
      }),

      checkAllFriendsDone: () => {
        const { friendStates } = get();
        return Object.values(friendStates).every(s => s.isDone);
      },

      startSynthesis: () => set({
        synthesisState: { ...initialSynthesisState, isStreaming: true },
        shouldStartSynthesis: false,
      }),

      updateSynthesisStreaming: (content) => set((state) => ({
        synthesisState: {
          ...state.synthesisState,
          content,
        },
      })),

      setSynthesisDone: (content) => set((state) => ({
        synthesisState: {
          ...state.synthesisState,
          content,
          isStreaming: false,
          isDone: true,
        },
      })),

      endSubmission: () => set({
        isSubmitting: false,
      }),

      reset: () => set({
        isSubmitting: false,
        activePrompt: null,
        friendStates: {},
        synthesisState: initialSynthesisState,
        shouldStartSynthesis: false,
      }),
    }),
    {
      name: 'openchat-react-store',
      partialize: (state) => ({
        friends: state.friends,
        models: state.models,
        groupSettings: state.groupSettings,
        currentLanguage: state.currentLanguage,
      }),
    }
  )
);
