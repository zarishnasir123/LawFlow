import { dateSeparatorLabel } from "../utils/chatMessages";

// A centered "Today / Yesterday / date" divider shown between messages from
// different calendar days.
export default function ChatDateSeparator({ iso }: { iso: string }) {
  return (
    <div className="my-3 flex justify-center">
      <span className="rounded-full bg-gray-200/80 px-3 py-1 text-[11px] font-medium text-gray-600">
        {dateSeparatorLabel(iso)}
      </span>
    </div>
  );
}
