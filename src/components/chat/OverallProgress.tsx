import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import type { FriendStreamState } from "@/types/chat";

interface OverallProgressProps {
  friendStates: Record<string, FriendStreamState>;
  isSynthesisActive?: boolean;
  currentLanguage?: string;
}

const I18N = {
  "zh-CN": {
    waiting: "等待中...",
    completed: "已完成",
    synthesisInProgress: "正在合成回答...",
    synthesisComplete: "合成完成",
    responded: "已回复",
    of: "",
    friends: "群友",
  },
  en: {
    waiting: "Waiting...",
    completed: "Completed",
    synthesisInProgress: "Synthesizing responses...",
    synthesisComplete: "Synthesis complete",
    responded: "responded",
    of: "of",
    friends: "friends",
  },
};

export function OverallProgress({
  friendStates,
  isSynthesisActive = false,
  currentLanguage = "zh-CN",
}: OverallProgressProps) {
  const t = I18N[currentLanguage as keyof typeof I18N] || I18N.en;

  const totalFriends = Object.keys(friendStates).length;
  const completedFriends = Object.values(friendStates).filter(
    (s) => s.isDone
  ).length;

  const progressValue =
    totalFriends > 0 ? (completedFriends / totalFriends) * 100 : 0;

  const isComplete = completedFriends >= totalFriends && totalFriends > 0;

  if (totalFriends === 0) {
    return null;
  }

  return (
    <div className="w-full rounded-lg border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 mt-2">
      <div className="px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Progress value={progressValue} max={100} className="h-2" />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
            {isSynthesisActive ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{t.synthesisInProgress}</span>
              </>
            ) : isComplete ? (
              <>
                <span className="text-primary">{t.completed}</span>
              </>
            ) : (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>
                  {completedFriends}/{totalFriends} {t.friends} {t.responded}，
                  {t.waiting}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
