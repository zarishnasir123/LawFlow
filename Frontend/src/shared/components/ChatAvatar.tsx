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
  return (
    <div
      className={`rounded-full bg-[#01411C] text-white font-bold flex items-center justify-center overflow-hidden ${className}`}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="h-full w-full object-cover"
        />
      ) : (
        initials
      )}
    </div>
  );
}
