import { Badge } from "@/components/ui/badge";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
import { Sparkles, Loader2, CopyIcon } from "lucide-react";
import type { SynthesisStreamState } from "@/types/chat";

interface SynthesisCardProps {
  state: SynthesisStreamState;
}

export function SynthesisCard({ state }: SynthesisCardProps) {
  const isActive = state.isStreaming || state.isDone;

  if (!isActive) {
    return null;
  }

  return (
    <Message from="assistant">
      <MessageContent className="border-l-2 border-primary/30 pl-4">
        {/* Synthesis header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Synthesis</span>
              <Badge variant="default" className="text-xs">
                Merged
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              Combined insights from all friends
            </span>
          </div>
          {state.isStreaming && !state.isDone && (
            <Loader2 className="ml-auto h-4 w-4 animate-spin text-primary" />
          )}
          {state.isDone && (
            <Sparkles className="ml-auto h-4 w-4 text-primary" />
          )}
        </div>

        {/* Synthesis content with built-in markdown rendering */}
        {state.content ? (
          <MessageResponse>{state.content}</MessageResponse>
        ) : state.isStreaming ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Synthesizing responses...</span>
          </div>
        ) : null}
      </MessageContent>

      {/* Copy button */}
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
