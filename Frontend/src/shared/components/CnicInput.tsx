import { useLayoutEffect, useRef, type ChangeEvent } from "react";

import { cnicCaretPos, cnicDigits, cnicSkeleton, formatCnic } from "../utils/pkFormat";

// A fixed-template CNIC input. The box always shows the skeleton
// "_____-_______-_": the two dashes are permanent, typed digits fill the
// underscore slots left-to-right, and the caret is parked on the next empty
// slot. The user only ever types digits. The value pushed up via `onChange`
// is the clean CNIC with real dashes and no underscores (e.g. "34104-1234567-1"
// or a partial "34104-1"), so validation and the backend both see exactly the
// format they expect.
//
// The skeleton is drawn in gray with typed digits in dark ink. A native input
// paints all its text one colour, so we render the real input with transparent
// text (keeping its blinking caret) and lay a gray "ghost" of the skeleton over
// it. The ghost copies the input's real font + box metrics so the glyphs and
// caret line up exactly.
type CnicInputProps = {
  // Clean model value (real dashes, no underscores), or "" when empty.
  value: string;
  // Receives the clean model value after every edit.
  onChange: (clean: string) => void;
  onBlur?: () => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

const DIGIT_INK = "#111827"; // gray-900 — typed digits + caret

export default function CnicInput({
  value,
  onChange,
  onBlur,
  id,
  name,
  disabled,
  readOnly,
  className,
  "aria-invalid": ariaInvalid,
}: CnicInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const digits = cnicDigits(value);
  const skeleton = cnicSkeleton(digits);
  const locked = Boolean(disabled || readOnly);

  // Sync the DOM value + caret whenever the model changes from outside the
  // component (form reset, edit-mode prefill). During typing `commit` has
  // already repaired the DOM, so this just re-affirms it.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.value !== skeleton) el.value = skeleton;
    if (document.activeElement === el) {
      const pos = cnicCaretPos(digits.length);
      el.setSelectionRange(pos, pos);
    }
  });

  // Mirror the input's real typography + box metrics onto the ghost overlay so
  // the gray skeleton lines up exactly over the transparent input text + caret.
  useLayoutEffect(() => {
    const el = ref.current;
    const ov = overlayRef.current;
    if (!el || !ov) return;
    const cs = getComputedStyle(el);
    ov.style.boxSizing = "border-box";
    ov.style.paddingTop = cs.paddingTop;
    ov.style.paddingRight = cs.paddingRight;
    ov.style.paddingBottom = cs.paddingBottom;
    ov.style.paddingLeft = cs.paddingLeft;
    ov.style.borderStyle = "solid";
    ov.style.borderColor = "transparent";
    ov.style.borderTopWidth = cs.borderTopWidth;
    ov.style.borderRightWidth = cs.borderRightWidth;
    ov.style.borderBottomWidth = cs.borderBottomWidth;
    ov.style.borderLeftWidth = cs.borderLeftWidth;
    ov.style.fontFamily = cs.fontFamily;
    ov.style.fontSize = cs.fontSize;
    ov.style.fontWeight = cs.fontWeight;
    ov.style.fontStyle = cs.fontStyle;
    ov.style.letterSpacing = cs.letterSpacing;
    ov.style.lineHeight = cs.lineHeight;
    ov.style.textAlign = cs.textAlign;
  });

  // Write the skeleton straight to the DOM and park the caret on the next empty
  // slot, then push the clean value up. Repairing the DOM here (not only via the
  // effect) keeps stray characters out and the caret correct even when the
  // parent doesn't re-render (e.g. the value didn't actually change).
  const commit = (nextDigits: string) => {
    const el = ref.current;
    if (el) {
      el.value = cnicSkeleton(nextDigits);
      const pos = cnicCaretPos(nextDigits.length);
      el.setSelectionRange(pos, pos);
    }
    onChange(formatCnic(nextDigits));
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    let next = cnicDigits(e.target.value);
    // A deletion that only removed a separator (dash) leaves the digit count
    // unchanged — treat it as deleting the digit before the caret so Backspace
    // works over the dashes on every platform (incl. mobile, which fires no
    // keydown for the delete).
    if (
      e.target.value.length < skeleton.length &&
      next.length === digits.length &&
      next.length > 0
    ) {
      next = next.slice(0, -1);
    }
    commit(next);
  };

  const parkCaret = () => {
    const el = ref.current;
    if (!el) return;
    const pos = cnicCaretPos(cnicDigits(el.value).length);
    el.setSelectionRange(pos, pos);
  };

  // Disabled / read-only (e.g. admin edit mode showing an existing CNIC): a
  // plain input, no overlay, so the muted disabled styling shows through.
  if (locked) {
    return (
      <input
        ref={ref}
        id={id ?? name}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        readOnly={readOnly}
        defaultValue={skeleton}
        className={className}
        aria-invalid={ariaInvalid}
      />
    );
  }

  return (
    <div className="relative w-full">
      <input
        ref={ref}
        id={id ?? name}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        defaultValue={skeleton}
        className={className}
        style={{ color: "transparent", caretColor: DIGIT_INK }}
        aria-invalid={ariaInvalid}
        onChange={handleChange}
        // Keep entry strictly left-to-right: focusing or clicking parks the
        // caret on the next empty slot (rAF so it runs after the browser's own
        // caret placement).
        onFocus={() => requestAnimationFrame(parkCaret)}
        onClick={() => requestAnimationFrame(parkCaret)}
        onBlur={onBlur}
      />
      <div
        ref={overlayRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden whitespace-nowrap"
      >
        {skeleton.split("").map((ch, i) => (
          <span
            key={i}
            className={/\d/.test(ch) ? "text-gray-900" : "text-gray-400"}
          >
            {ch}
          </span>
        ))}
      </div>
    </div>
  );
}
