// src/types/chat.ts

export interface Friend {
  id: string;
  name: string;
  avatar?: string;
  modelAvatar?: string;
  modelConfigId: string;
  modelConfigName: string;
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  thinkingEnabled?: boolean;
  systemPrompt?: string;
  description?: string;
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  avatar?: string;
  enabled: boolean;
  description?: string;
  thinkingEnabled?: boolean;
}

export interface GroupSettings {
  memberIds: string[];
  sharedSystemPromptEnabled: boolean;
  sharedSystemPrompt: string;
  platformFeatureEnabled: boolean;
  preferredPlatform: string;
  synthesisFriendId: string | null;
}

export interface FriendStreamState {
  friendId: string;
  isStreaming: boolean;
  isDone: boolean;
  content: string;
  thinking: string;
  error?: string;
}

export interface SynthesisStreamState {
  isStreaming: boolean;
  isDone: boolean;
  content: string;
}

export interface ConversationMessage {
  id: string;
  friendId: string;
  friendName: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  timestamp: number;
}

export type ProviderKind = 'anthropic' | 'google' | 'openai-compatible';
