import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  CheckCircle2,
  Loader2,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from "../api/notifications";

const PREFERENCES_KEY = ["admin", "notification-preferences"] as const;

// Defaults (all on) shown while the real values load.
const DEFAULTS: NotificationPreferences = {
  emailEnabled: true,
  case: true,
  hearing: true,
  message: true,
  document: true,
  payment: true,
  verification: true,
  payout: true,
};

// The admin's only optional emails are the two action alerts. Hearings/cases/
// payments/etc. never email the admin, so they're intentionally not shown.
const CATEGORIES: Array<{
  key: "verification" | "payout";
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    key: "verification",
    label: "Lawyer Verifications",
    description: "When a new lawyer registers and awaits verification",
    icon: BadgeCheck,
  },
  {
    key: "payout",
    label: "Payout Requests",
    description: "When a lawyer requests a payout",
    icon: Wallet,
  },
];

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-[#01411C]" : "bg-gray-300"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// Email preferences for the admin. The in-app center always shows everything;
// these toggles only gate the two optional admin emails. On save it returns to
// the inbox via onSaved.
export default function NotificationPreferencesPanel({
  onSaved,
}: {
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();

  const prefsQuery = useQuery({
    queryKey: PREFERENCES_KEY,
    queryFn: fetchNotificationPreferences,
  });

  const [patch, setPatch] = useState<Partial<NotificationPreferences>>({});

  const base = prefsQuery.data ?? DEFAULTS;
  const effective: NotificationPreferences = { ...base, ...patch };
  const dirty = Object.keys(patch).length > 0;

  const saveMutation = useMutation({
    mutationFn: () => updateNotificationPreferences(patch),
    onSuccess: (saved) => {
      queryClient.setQueryData(PREFERENCES_KEY, saved);
      onSaved();
    },
  });

  const toggle = (key: keyof NotificationPreferences) =>
    setPatch((prev) => ({ ...prev, [key]: !effective[key] }));

  if (prefsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading your preferences…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Master switch */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[#01411C]/20 bg-[#01411C]/5 p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">Email Notifications</p>
          <p className="text-xs text-gray-600">Master switch for all admin email alerts below</p>
        </div>
        <Toggle
          checked={effective.emailEnabled}
          onChange={() => toggle("emailEnabled")}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Email me about
        </p>
        <div className="space-y-2">
          {CATEGORIES.map(({ key, label, description, icon: Icon }) => (
            <div
              key={key}
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-lg bg-gray-100 p-2 text-gray-600">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="truncate text-xs text-gray-500">{description}</p>
                </div>
              </div>
              <Toggle
                checked={effective.emailEnabled && effective[key]}
                disabled={!effective.emailEnabled}
                onChange={() => toggle(key)}
              />
            </div>
          ))}
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-gray-400">
        <CheckCircle2 className="h-3.5 w-3.5 text-[#01411C]" />
        In-app alerts always appear in your notification center.
      </p>

      {saveMutation.isError && (
        <p className="rounded-md bg-rose-50 p-2.5 text-xs text-rose-600">
          Couldn&apos;t save your preferences. Please try again.
        </p>
      )}

      <div className="border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#01411C] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#025227] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {dirty ? "Save Preferences" : "No changes"}
        </button>
      </div>
    </div>
  );
}
