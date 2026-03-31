// src/stores/chatStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { buildScopedStorageKey, normalizeLocalAccount } from '../utils/account-scope-utils.mjs';
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
  updateGroupMemberIds: (memberIds: string[]) => void;
  endSubmission: () => void;
  reset: () => void;
}

export const STORAGE_KEYS = {
  account: 'multiplechat-local-account',
  friends: 'openchat-friend-profiles',
  models: 'multiplechat-model-configs',
  groupSettings: 'openchat-default-group-settings',
  language: 'multiplechat-language',
};

// Non-scoped keys that should be read directly (no account prefix)
const NON_SCOPED_KEYS = [STORAGE_KEYS.language];

/** Read the account object that vanilla JS wrote to localStorage */
function getAccountFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.account);
    return normalizeLocalAccount(raw ? JSON.parse(raw) : {});
  } catch {
    return normalizeLocalAccount({});
  }
}

/** Resolve the actual localStorage key, matching vanilla JS scoping */
function getScopedKey(baseKey: string): string {
  if (NON_SCOPED_KEYS.includes(baseKey)) return baseKey;
  return buildScopedStorageKey(baseKey, getAccountFromStorage());
}

function readScoped(baseKey: string, fallback: unknown = null) {
  try {
    const raw = localStorage.getItem(getScopedKey(baseKey));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeScoped(baseKey: string, value: unknown) {
  localStorage.setItem(getScopedKey(baseKey), JSON.stringify(value));
}

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

      // Load data from existing localStorage keys (scoped)
      loadFromStorage: () => {
        try {
          const friends = readScoped(STORAGE_KEYS.friends, []) as Friend[];
          const models = readScoped(STORAGE_KEYS.models, []) as Model[];
          const groupSettings = readScoped(STORAGE_KEYS.groupSettings, null) as GroupSettings | null;
          const currentLanguage = (localStorage.getItem(STORAGE_KEYS.language) || 'zh-CN') as string;

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

      updateGroupMemberIds: (memberIds) => {
        const current = get().groupSettings || {
          memberIds: [],
          sharedSystemPromptEnabled: false,
          sharedSystemPrompt: "",
          platformFeatureEnabled: false,
          preferredPlatform: "gemini",
          synthesisFriendId: null,
        };
        const updated = { ...current, memberIds };
        // Keep synthesisFriendId valid
        if (updated.synthesisFriendId && !memberIds.includes(updated.synthesisFriendId)) {
          updated.synthesisFriendId = memberIds[0] || null;
        }
        set({ groupSettings: updated });
        try {
          writeScoped(STORAGE_KEYS.groupSettings, updated);
          window.dispatchEvent(new CustomEvent("openchat-storage-sync"));
        } catch (e) {
          console.error("Failed to persist group settings:", e);
        }
      },

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
