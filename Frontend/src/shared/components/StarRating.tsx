import { useState } from "react";
import { Star } from "lucide-react";

interface StarRatingProps {
  // 0–5; may be fractional for display (e.g. 4.6 shows a half star).
  value?: number | null;
  // When provided, the stars become an interactive 1–5 input.
  onChange?: (value: number) => void;
  // Star size in px (default 16).
  size?: number;
  className?: string;
  readOnly?: boolean;
}

// Reusable star rating — a read-only display (supports half stars) or, when
// `onChange` is passed, a clickable 1–5 input with hover preview. Amber stars on
// gray, matching the placeholders already in the lawyer card/profile.
export default function StarRating({
  value = 0,
  onChange,
  size = 16,
  className = "",
  readOnly = false,
}: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const interactive = Boolean(onChange) && !readOnly;
  const shown = interactive && hover > 0 ? hover : value || 0;
  const dimension = { width: size, height: size };

  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = shown >= i;
        const half = !filled && shown >= i - 0.5;
        const cls = filled
          ? "fill-amber-400 text-amber-400"
          : half
            ? "fill-amber-400/50 text-amber-400"
            : "text-gray-300";

        if (interactive && onChange) {
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(i)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(0)}
              className="leading-none transition hover:scale-110"
              aria-label={`${i} star${i > 1 ? "s" : ""}`}
            >
              <Star style={dimension} className={cls} />
            </button>
          );
        }

        return <Star key={i} style={dimension} className={cls} />;
      })}
    </span>
  );
}
