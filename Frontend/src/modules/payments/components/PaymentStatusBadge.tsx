type PaymentStatus =
  | "draft"
  | "active"
  | "completed"
  | "cancelled"
  | "pending"
  | "partially_paid"
  | "paid"
  | "overdue";

const styles: Record<PaymentStatus, { badge: string; dot: string }> = {
  draft: {
    badge: "border border-slate-200 bg-slate-50 text-slate-700",
    dot: "bg-slate-400",
  },
  active: {
    badge: "border border-blue-200 bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
  },
  completed: {
    badge: "border border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  cancelled: {
    badge: "border border-rose-200 bg-rose-50 text-rose-700",
    dot: "bg-rose-500",
  },
  pending: {
    badge: "border border-slate-200 bg-slate-50 text-slate-700",
    dot: "bg-slate-400",
  },
  partially_paid: {
    badge: "border border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  paid: {
    badge: "border border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  overdue: {
    badge: "border border-rose-200 bg-rose-50 text-rose-700",
    dot: "bg-rose-500",
  },
};

function toLabel(status: PaymentStatus): string {
  return status
    .replace(/_/g, " ")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles[status].badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full shadow-sm ${styles[status].dot}`} />
      {toLabel(status)}
    </span>
  );
}
