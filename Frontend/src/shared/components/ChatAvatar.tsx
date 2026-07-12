import { useState } from "react";

interface ChatAvatarProps {
  name: string;
  initials: string;
  avatarUrl?: string | null;
  // Sizing/spacing utility classes for the circle, e.g. "w-10 h-10 text-xs".
  className?: string;
}

// Circular chat avatar: shows the user's uploaded profile photo when present,
// otherwise falls back to their initials on the brand-green circle. Used for
// the inbox list, chat header, and the interaction side-panel so every chat
// avatar renders the same way.
export default function ChatAvatar({
  name,
  initials,
  avatarUrl,
  className = "",
}: ChatAvatarProps) {
  // If the image fails to load (missing object / expired signed URL) fall back
  // to the initials instead of the browser's broken-image + alt text. Tracking
  // the specific failed URL means a new avatarUrl still gets a fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(avatarUrl) && failedUrl !== avatarUrl;

  return (
    <div
      className={`rounded-full bg-[#01411C] text-white font-bold flex items-center justify-center overflow-hidden ${className}`}
    >
      {showImage ? (
        <img
          src={avatarUrl ?? undefined}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setFailedUrl(avatarUrl ?? null)}
        />
      ) : (
        initials
      )}
    </div>
  );
}
