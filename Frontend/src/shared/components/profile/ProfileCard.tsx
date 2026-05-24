import React from "react";
import { Camera, Pencil } from "lucide-react";

interface ProfileCardProps {
  name: string;
  memberSince: string;
  roleLabel: string;
  // Optional URL to the user's uploaded profile picture. When set,
  // the avatar circle renders the image; when null/undefined, it
  // falls back to a green-on-white initials circle using the first
  // letter of `name`. Either way the visual slot is the same 56px
  // round shape so the rest of the header layout stays put.
  avatarUrl?: string | null;
  // Click handler for the avatar itself. When provided, the avatar
  // becomes interactive (cursor + camera overlay on hover) so the
  // page can trigger a file picker. When omitted the avatar is
  // purely decorative.
  onAvatarClick?: () => void;
  // True while a new avatar is uploading — swaps the camera hint
  // for a "Uploading…" pill so the user knows the click registered.
  avatarUploading?: boolean;
  onEdit?: () => void;
  children: React.ReactNode;
}

export default function ProfileCard({
  name,
  memberSince,
  roleLabel,
  avatarUrl,
  onAvatarClick,
  avatarUploading = false,
  onEdit,
  children,
}: ProfileCardProps) {
  const initials = name.charAt(0).toUpperCase();
  const isInteractive = Boolean(onAvatarClick);

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl border p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          {/* Avatar slot. The outer wrapper is a button only when an
              onAvatarClick handler is wired up; otherwise it's a plain
              div so the cursor doesn't lie. The image and the
              fallback initials share the same dimensions so swapping
              between them doesn't shift surrounding layout. */}
          <button
            type="button"
            onClick={onAvatarClick}
            disabled={!isInteractive || avatarUploading}
            aria-label={isInteractive ? "Change profile picture" : "Profile picture"}
            // Cursor logic: wait while an upload is in flight,
            // pointer when the avatar is interactive, default
            // otherwise. We intentionally don't use the
            // `disabled:cursor-wait` Tailwind variant — that would
            // ALSO show the wait cursor on the view page where the
            // button is `disabled` purely because there's no click
            // handler (not because anything is loading).
            className={`relative h-14 w-14 rounded-full overflow-hidden flex items-center justify-center text-white text-xl font-semibold bg-[#01411C] ${
              avatarUploading
                ? "cursor-wait"
                : isInteractive
                  ? "cursor-pointer"
                  : "cursor-default"
            } ${
              isInteractive
                ? "group focus:outline-none focus:ring-2 focus:ring-[#01411C] focus:ring-offset-2"
                : ""
            }`}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name}
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <span>{initials}</span>
            )}

            {isInteractive && (
              <span
                className={`absolute inset-0 flex items-center justify-center bg-black/45 text-white text-[10px] font-medium gap-1 transition-opacity ${
                  avatarUploading
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                }`}
              >
                {avatarUploading ? (
                  "Uploading…"
                ) : (
                  <>
                    <Camera size={14} />
                    Change
                  </>
                )}
              </span>
            )}
          </button>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{name}</h2>
            <p className="text-sm text-gray-500">
              Member since {memberSince}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1 text-xs rounded-full bg-gray-100">
            {roleLabel}
          </span>
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-2 border px-3 py-1.5 rounded-md text-sm hover:bg-gray-50"
            >
              <Pencil size={14} />
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="space-y-6">{children}</div>
    </div>
  );
}
