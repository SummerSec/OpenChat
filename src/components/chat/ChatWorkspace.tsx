import * as React from "react";
import { useChatStore } from "@/hooks/useChatStore";
import { FriendChatCard } from "./FriendChatCard";
import { SynthesisCard } from "./SynthesisCard";
import { OverallProgress } from "./OverallProgress";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";

export function ChatWorkspace() {
  const store = useChatStore();

  // Load data from storage on mount
  React.useEffect(() => {
    store.loadFromStorage();
  }, []);

  // Re-sync from localStorage when vanilla JS dispatches changes
  React.useEffect(() => {
    const handleSync = () => store.loadFromStorage();
    window.addEventListener("openchat-storage-sync", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("openchat-storage-sync", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  // Resolve active group members: use groupSettings.memberIds to pick
  // which friends participate, falling back to all enabled friends.
  const enabledFriends = React.useMemo(() => {
    const enabled = store.friends.filter((f) => f.enabled !== false);
    const memberIds = store.groupSettings?.memberIds;
    if (Array.isArray(memberIds) && memberIds.length > 0) {
      const members = memberIds
        .map((id) => enabled.find((f) => f.id === id))
        .filter(Boolean) as typeof enabled;
      return members.length > 0 ? members : enabled;
    }
    return enabled;
  }, [store.friends, store.groupSettings]);

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

  return (
    <Conversation className="chat-workspace-inline">
      <ConversationContent className="gap-6">
        {/* User prompt display */}
        {store.activePrompt && (
          <Message from="user">
            <MessageContent>
              <MessageResponse>{store.activePrompt}</MessageResponse>
            </MessageContent>
          </Message>
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
            />
          ))}

        {/* Synthesis card */}
        <SynthesisCard state={store.synthesisState} />

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
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
