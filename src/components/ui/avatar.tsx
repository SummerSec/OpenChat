import * as React from "react";
import { Avatar as LobeAvatar } from "@lobehub/ui";
import { cn } from "@/lib/utils";

/**
 * Generate a consistent HSL background color from a name string.
 * Produces vibrant, distinct colors for different names.
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
  /** Size in pixels, passed to @lobehub/ui Avatar. Defaults to 40. */
  size?: number;
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, size, style, ...props }, ref) => {
    const displaySize = size || 40;
    const background = nameToColor(fallback || alt || "AI");

    return (
      <div
        ref={ref}
        className={cn("relative shrink-0", className)}
        style={{ width: displaySize, height: displaySize, ...style }}
        {...props}
      >
        <LobeAvatar
          avatar={src || undefined}
          title={fallback || alt || "AI"}
          alt={alt || fallback || ""}
          size={displaySize}
          shape="circle"
          background={src ? undefined : background}
        />
      </div>
    );
  }
);
Avatar.displayName = "Avatar";

export { Avatar, nameToColor };
