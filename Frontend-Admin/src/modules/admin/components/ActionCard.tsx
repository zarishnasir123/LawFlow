import type { LucideIcon } from "lucide-react";

type Props = {
  title: string;
  description: string;
  badgeText: string;
  icon: LucideIcon;
  iconBgClass: string;
  iconTextClass: string;
  badgeClassName: string;
  onClick: () => void;
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
}: Props) {
  return (
    <div
      className="p-6 bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <div className="flex items-center gap-4 mb-4">
        <div className={`${iconBgClass} p-3 rounded-lg`}>
          <Icon className={`h-6 w-6 ${iconTextClass}`} />
        </div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>

      <p className="text-sm text-gray-600 mb-4">{description}</p>

      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${badgeClassName}`}>
        {badgeText}
      </span>
    </div>
  );
}
