import type { QuickActionItem } from "../../types/dashboard";
import Card from "./Card";

type QuickActionsProps = {
  actions: QuickActionItem[];
  onNavigate: (to: string) => void;
};

export default function QuickActions({ actions, onNavigate }: QuickActionsProps) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#01411C]">Quick Actions</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              onClick={() => onNavigate(action.to)}
              className={[
                "flex h-full flex-col items-center justify-center gap-2 rounded-xl px-4 py-4 text-sm font-semibold text-white transition",
                action.className,
              ].join(" ")}
            >
              <Icon className="h-6 w-6" />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
