import { ArrowRight, type LucideIcon } from "lucide-react";

type Props = {
  title: string;
  description: string;
  badgeText: string;
  icon: LucideIcon;
  iconBgClass: string;
  iconTextClass: string;
  badgeClassName: string;
  onClick: () => void;
  /**
   * Optional pending-count pill rendered in the top-right of the card.
   * Used for the "Verify Lawyer" card to surface the number of pending
   * lawyer verifications coming from the lawyer side. Hidden when 0 or
   * undefined.
   */
  pendingCount?: number;
  /**
   * Tailwind classes for the pending-count pill background + text. Defaults
   * to amber to match the sidebar "Lawyer Verifications" badge.
   */
  pendingCountClassName?: string;
};

export function ActionCard({
  title,
  description,
  badgeText,
  icon: Icon,
  iconBgClass,
  iconTextClass,
  badgeClassName,
  onClick,
  pendingCount,
  pendingCountClassName = "bg-amber-500 text-white",
}: Props) {
  const showPendingCount = typeof pendingCount === "number" && pendingCount > 0;

  return (
    <div
      className="group relative flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-lg cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      {showPendingCount ? (
        <span
          className={`absolute top-4 right-4 inline-flex min-w-[24px] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold shadow-sm ${pendingCountClassName}`}
          title={`${pendingCount} pending`}
          aria-label={`${pendingCount} pending`}
        >
          {pendingCount}
        </span>
      ) : null}

      <div className="mb-4 flex items-center gap-3">
        <div className={`${iconBgClass} rounded-xl p-2.5`}>
          <Icon className={`h-5 w-5 ${iconTextClass}`} />
        </div>
        <h3 className="text-[15px] font-semibold tracking-tight text-gray-900">
          {title}
        </h3>
      </div>

      <p className="mb-5 flex-1 text-sm leading-relaxed text-gray-600">
        {description}
      </p>

      <span
        className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition group-hover:gap-2 ${badgeClassName}`}
      >
        {badgeText}
        <ArrowRight className="h-3 w-3 opacity-70 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
      </span>
    </div>
  );
}
