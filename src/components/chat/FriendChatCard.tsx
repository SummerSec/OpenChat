import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import { Loader2, CopyIcon } from "lucide-react";
import type { Friend, FriendStreamState } from "@/types/chat";

interface FriendChatCardProps {
  friend: Friend;
  state: FriendStreamState;
}

export function FriendChatCard({ friend, state }: FriendChatCardProps) {
  const displayAvatar = friend.avatar || friend.modelAvatar;
  const isLoading = state.isStreaming && !state.isDone;

  return (
    <Message from="assistant">
      <MessageContent>
        {/* Friend header with avatar, name, provider badge */}
        <div className="flex items-center gap-3 mb-2">
          <Avatar
            src={displayAvatar}
            alt={friend.name}
            fallback={friend.name}
            className="h-8 w-8"
          />
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{friend.name}</span>
              <Badge variant="secondary" className="text-xs">
                {friend.provider}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              {friend.model}
            </span>
          </div>
          {isLoading && (
            <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Thinking/Reasoning block */}
        {state.thinking && (
          <Reasoning isStreaming={isLoading}>
            <ReasoningTrigger />
            <ReasoningContent>{state.thinking}</ReasoningContent>
          </Reasoning>
        )}

        {/* Main content with built-in markdown rendering */}
        {state.content ? (
          <MessageResponse>{state.content}</MessageResponse>
        ) : isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Waiting for response...</span>
          </div>
        ) : null}

        {/* Error state */}
        {state.error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {state.error}
          </div>
        )}
      </MessageContent>

      {/* Copy button — appears for all friends after generation completes */}
      {state.isDone && state.content && (
        <MessageActions>
          <MessageAction
            onClick={() => navigator.clipboard.writeText(state.content)}
            tooltip="Copy"
            label="Copy"
          >
            <CopyIcon className="size-3" />
          </MessageAction>
        </MessageActions>
      )}
    </Message>
  );
}
