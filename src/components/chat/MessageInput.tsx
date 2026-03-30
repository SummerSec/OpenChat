import * as React from "react";
import { Loader2, Send } from "lucide-react";

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
    sending: "发送中...",
  },
  en: {
    placeholder: "Type a message and press Enter to send...",
    noFriendsEnabled: "Please enable at least one friend first",
    sending: "Sending...",
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
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!input.trim() || isSubmitting || disabled) return;
    onSubmit(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  const displayPlaceholder =
    placeholder || (disabled ? disabledMessage || t.noFriendsEnabled : t.placeholder);

  return (
    <div className="border-t bg-background p-4">
      <div className="container mx-auto max-w-4xl">
        {disabled && !isSubmitting && (
          <div className="mb-3 text-center text-sm text-muted-foreground">
            {disabledMessage || t.noFriendsEnabled}
          </div>
        )}
        <div className="relative flex items-end gap-2 rounded-lg border bg-muted/50 p-2 focus-within:bg-background focus-within:ring-1 focus-within:ring-ring">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={displayPlaceholder}
            disabled={isSubmitting || disabled}
            rows={1}
            className="flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 min-h-[40px] max-h-[200px]"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isSubmitting || disabled}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50 transition-colors"
            aria-label={t.sending}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
