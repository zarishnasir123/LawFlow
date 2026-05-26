import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

export type ProfileMenuItem = {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  // When true, renders the item in red — used for the Logout slot
  // so the destructive action stands out from "View Profile".
  danger?: boolean;
};

type HeaderProfileMenuProps = {
  // Avatar inputs — mirror what the HeaderAction avatar variant uses.
  avatarUrl: string | null | undefined;
  fallbackInitial: string;
  // Header strip inside the dropdown. displayName is the bold line;
  // email is the muted line below it. Both optional in case the
  // current user record hasn't finished loading.
  displayName?: string;
  email?: string;
  items: ProfileMenuItem[];
};

// Gmail-style profile chip: the avatar acts as a trigger; clicking it
// opens a dropdown anchored to the top-right of the avatar. Closes on
// outside-click, Escape, or any item activation.
export default function HeaderProfileMenu({
  avatarUrl,
  fallbackInitial,
  displayName,
  email,
  items,
}: HeaderProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close when clicking outside the menu or pressing Escape. Both
  // listeners attach only while the menu is open so we don't leak a
  // permanent document listener.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Account"
        className="relative h-9 w-9 rounded-full overflow-hidden bg-white/10 ring-2 ring-transparent hover:ring-white/40 transition-all"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName || "Profile"}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
            {fallbackInitial || "?"}
          </span>
        )}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg bg-white text-gray-700 shadow-lg ring-1 ring-black/5 overflow-hidden"
        >
          {(displayName || email) ? (
            <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
              <div className="h-10 w-10 rounded-full overflow-hidden bg-[#01411C] flex-shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName || "Profile"}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
                    {fallbackInitial || "?"}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                {displayName ? (
                  <div className="truncate text-sm font-semibold text-gray-900">
                    {displayName}
                  </div>
                ) : null}
                {email ? (
                  <div className="truncate text-xs text-gray-500">{email}</div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="py-1">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    item.onClick();
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors ${
                    item.danger
                      ? "text-red-600 hover:bg-red-50"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
