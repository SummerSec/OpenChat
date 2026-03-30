import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2 } from "lucide-react";
import type { SynthesisStreamState } from "@/types/chat";

interface SynthesisCardProps {
  state: SynthesisStreamState;
  renderMarkdown?: (content: string) => string;
}

export function SynthesisCard({ state, renderMarkdown }: SynthesisCardProps) {
  const formatContent = (content: string) => {
    if (!content) return "";
    if (renderMarkdown) {
      return renderMarkdown(content);
    }
    return content;
  };

  const isActive = state.isStreaming || state.isDone;

  if (!isActive) {
    return null;
  }

  return (
    <Card className="w-full border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-col gap-1">
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
      </CardHeader>
      <CardContent>
        {state.content ? (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{
              __html: formatContent(state.content),
            }}
          />
        ) : state.isStreaming ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Synthesizing responses...</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
