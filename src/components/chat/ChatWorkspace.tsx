import * as React from "react";
import { useChatStore } from "@/hooks/useChatStore";
import { FriendChatCard } from "./FriendChatCard";
import { SynthesisCard } from "./SynthesisCard";
import { OverallProgress } from "./OverallProgress";
import { MessageInput } from "./MessageInput";

// Import the markdown renderer - will be resolved at runtime
const renderSafeMarkdown = (content: string): string => {
  // This is a placeholder - the actual function will be imported by the parent
  return content;
};

interface ChatWorkspaceProps {
  renderMarkdown?: (content: string) => string;
}

export function ChatWorkspace({
  renderMarkdown = renderSafeMarkdown,
}: ChatWorkspaceProps) {
  const store = useChatStore();

  // Load data from storage on mount
  React.useEffect(() => {
    store.loadFromStorage();
  }, []);

  // Check if any friends are enabled
  const enabledFriends = React.useMemo(() => {
    return store.friends.filter((f) => f.enabled);
  }, [store.friends]);

  // Get friend states for active friends
  const activeFriendStates = React.useMemo(() => {
    const states: typeof store.friendStates = {};
    enabledFriends.forEach((friend) => {
      if (store.friendStates[friend.id]) {
        states[friend.id] = store.friendStates[friend.id];
      }
    });
    return states;
  }, [enabledFriends, store.friendStates]);

  const handleSubmit = (message: string) => {
    if (!message.trim() || enabledFriends.length === 0) return;

    // Initialize friend states for all enabled friends
    const friendIds = enabledFriends.map((f) => f.id);
    store.startSubmission(message);
    store.initFriendStates(friendIds);

    // Trigger chat - this would be handled by the parent or a hook
    // For now, the store state is set up
  };

  const I18N = {
    "zh-CN": {
      noFriendsEnabled: "请先启用至少一个群友",
    },
    en: {
      noFriendsEnabled: "Please enable at least one friend first",
    },
  };

  const t =
    I18N[store.currentLanguage as keyof typeof I18N] || I18N.en;

  return (
    <div className="flex h-screen flex-col">
      {/* Main content area */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="container mx-auto max-w-4xl space-y-4">
          {/* Prompt display when submitting */}
          {store.activePrompt && (
            <div className="rounded-lg bg-muted p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">
                You
              </div>
              <div className="text-sm">{store.activePrompt}</div>
            </div>
          )}

          {/* Friend cards */}
          {store.isSubmitting &&
            enabledFriends.map((friend) => (
              <FriendChatCard
                key={friend.id}
                friend={friend}
                state={
                  store.friendStates[friend.id] || {
                    friendId: friend.id,
                    isStreaming: true,
                    isDone: false,
                    content: "",
                    thinking: "",
                  }
                }
                renderMarkdown={renderMarkdown}
              />
            ))}

          {/* Synthesis card */}
          <SynthesisCard
            state={store.synthesisState}
            renderMarkdown={renderMarkdown}
          />
        </div>
      </div>

      {/* Progress indicator */}
      {store.isSubmitting && (
        <OverallProgress
          friendStates={activeFriendStates}
          isSynthesisActive={
            store.synthesisState.isStreaming || store.synthesisState.isDone
          }
          currentLanguage={store.currentLanguage}
        />
      )}

      {/* Message input */}
      <MessageInput
        onSubmit={handleSubmit}
        isSubmitting={store.isSubmitting}
        disabled={enabledFriends.length === 0}
        disabledMessage={t.noFriendsEnabled}
        currentLanguage={store.currentLanguage}
      />
    </div>
  );
}
