import * as React from "react";
import { Avatar as LobeAvatar } from "@lobehub/ui";
import { cn } from "@/lib/utils";

/**
 * Generate a consistent HSL background color from a name string.
 */
function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback?: string;
  /** Size in pixels. Defaults to 40. */
  size?: number;
}

/**
 * Avatar component wrapping @lobehub/ui Avatar.
 *
 * - If `src` starts with http/data/slash → rendered as image
 * - If `src` is an emoji string → rendered as 3D Fluent Emoji via @lobehub/ui
 * - If no `src` → colored circle with name initials
 */
const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, size, style, ...props }, ref) => {
    const displaySize = size || 40;
    const label = fallback || alt || "AI";
    const background = nameToColor(label);

    // Determine what to pass as the avatar prop to LobeAvatar
    // URL/data images → pass as avatar (renders as <img>)
    // Emoji strings → pass as avatar (renders as FluentEmoji)
    // Empty → pass title only (renders initials with colored background)
    const isUrl = src && /^(https?:\/\/|\/|image\/)/i.test(src);
    const avatarValue = src || undefined;

    return (
      <div
        ref={ref}
        className={cn("relative shrink-0 [&_.ant-avatar]:border-0", className)}
        style={{ width: displaySize, height: displaySize, ...style }}
        {...props}
      >
        <LobeAvatar
          avatar={avatarValue}
          title={label}
          alt={alt || label}
          size={displaySize}
          shape="circle"
          background={isUrl ? undefined : background}
        />
      </div>
    );
  }
);
Avatar.displayName = "Avatar";

export { Avatar, nameToColor };
