import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import type { Friend, FriendStreamState } from "@/types/chat";

interface FriendChatCardProps {
  friend: Friend;
  state: FriendStreamState;
  renderMarkdown?: (content: string) => string;
}

export function FriendChatCard({
  friend,
  state,
  renderMarkdown,
}: FriendChatCardProps) {
  const displayAvatar = friend.avatar || friend.modelAvatar;
  const isLoading = state.isStreaming && !state.isDone;

  const formatContent = (content: string) => {
    if (!content) return "";
    if (renderMarkdown) {
      return renderMarkdown(content);
    }
    return content;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Avatar
            src={displayAvatar}
            alt={friend.name}
            fallback={friend.name}
            className="h-10 w-10"
          />
          <div className="flex flex-col gap-1">
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
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Thinking content */}
        {state.thinking && (
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Thinking
            </div>
            <div
              className="text-sm text-muted-foreground prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{
                __html: formatContent(state.thinking),
              }}
            />
          </div>
        )}

        {/* Main content */}
        {state.content ? (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{
              __html: formatContent(state.content),
            }}
          />
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
      </CardContent>
    </Card>
  );
}
