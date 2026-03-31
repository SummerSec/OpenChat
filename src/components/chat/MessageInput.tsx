import * as React from "react";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";

interface MessageInputProps {
  onSubmit: (message: string) => void;
  isSubmitting: boolean;
  disabled?: boolean;
  disabledMessage?: string;
  placeholder?: string;
  currentLanguage?: string;
}

const I18N = {
  "zh-CN": {
    placeholder: "输入消息按 Enter 发送...",
    noFriendsEnabled: "请先启用至少一个群友",
    goToFriends: "前往设置",
  },
  en: {
    placeholder: "Type a message and press Enter to send...",
    noFriendsEnabled: "Please enable at least one friend first",
    goToFriends: "Go to Friends",
  },
};

export function MessageInput({
  onSubmit,
  isSubmitting,
  disabled = false,
  disabledMessage,
  placeholder,
  currentLanguage = "zh-CN",
}: MessageInputProps) {
  const t = I18N[currentLanguage as keyof typeof I18N] || I18N.en;
  const [input, setInput] = React.useState("");

  const handleSubmit = (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (!text || disabled) return;
    onSubmit(text);
    setInput("");
  };

  const displayPlaceholder =
    placeholder ||
    (disabled ? disabledMessage || t.noFriendsEnabled : t.placeholder);

  return (
    <div className="border-t bg-background p-4">
      <div className="container mx-auto max-w-4xl">
        {disabled && !isSubmitting && (
          <div className="mb-3 text-center text-sm text-muted-foreground">
            {disabledMessage || t.noFriendsEnabled}{" "}
            <a
              href="friends.html"
              className="text-primary underline hover:text-primary/80"
            >
              {t.goToFriends}
            </a>
          </div>
        )}
        <PromptInput
          onSubmit={handleSubmit}
          className="relative"
        >
          <PromptInputTextarea
            value={input}
            placeholder={displayPlaceholder}
            onChange={(e) => setInput(e.currentTarget.value)}
            disabled={isSubmitting || disabled}
            className="pr-12"
          />
          <PromptInputSubmit
            status={isSubmitting ? "streaming" : "ready"}
            disabled={!input.trim() || disabled}
            className="absolute bottom-1 right-1"
          />
        </PromptInput>
      </div>
    </div>
  );
}
