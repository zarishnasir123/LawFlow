import type { ReactNode } from "react";
import { Scale } from "lucide-react";
import type { HeaderAction } from "../../types/dashboard";

type DashboardLayoutProps = {
  brandTitle?: React.ReactNode;
  brandSubtitle?: string;
  pageSubtitle?: string;
  actions?: HeaderAction[];
  // Slot rendered after the icon actions — used by the layouts to
  // drop in the Gmail-style profile dropdown (avatar trigger +
  // popover with View Profile / Logout).
  profileMenu?: ReactNode;
  showBackButton?: boolean;
  onBackClick?: () => void;
  backLabel?: string;
  children: ReactNode;
};

type HeaderActionButtonProps = {
  action: HeaderAction;
};

function HeaderActionButton({ action }: HeaderActionButtonProps) {
  const Icon = action.icon;
  const isAvatar = action.avatarUrl !== undefined || action.avatarFallback !== undefined;

  if (isAvatar) {
    return (
      <button
        type="button"
        onClick={action.onClick}
        className="relative h-9 w-9 rounded-full overflow-hidden bg-white/10 ring-2 ring-transparent hover:ring-white/40 transition-all"
        aria-label={action.label}
        title={action.label}
      >
        {action.avatarUrl ? (
          <img
            src={action.avatarUrl}
            alt={action.label}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
            {action.avatarFallback || "?"}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={action.onClick}
      className="relative rounded-lg p-2 transition-colors hover:bg-white/10"
      aria-label={action.label}
      title={action.label}
    >
      <Icon className="h-5 w-5" />
      {action.badge ? (
        <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
          {action.badge}
        </span>
      ) : null}
    </button>
  );
}

export default function DashboardLayout(props: DashboardLayoutProps) {
  const {
    brandTitle = "LawFlow",
    brandSubtitle = "Lawyer Portal",
    pageSubtitle,
    actions = [],
    profileMenu,
    children,
  } = props;
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#01411C] px-4 py-4 text-white shadow-md sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-none items-center justify-between">
          <div className="flex items-center gap-3">
            <Scale className="h-8 w-8" />
            <div>
              <h1 className="text-lg font-semibold">{brandTitle}</h1>
              {(pageSubtitle || brandSubtitle) ? (
                <p className="text-sm text-green-100">{pageSubtitle || brandSubtitle}</p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            {actions.map((action) => (
              <HeaderActionButton key={action.label} action={action} />
            ))}
            {profileMenu}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-none px-4 py-8 sm:px-6 lg:px-10">
        {children}
      </main>
    </div>
  );
}
