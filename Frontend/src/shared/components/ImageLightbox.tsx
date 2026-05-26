import { useEffect } from "react";
import { X } from "lucide-react";

type ImageLightboxProps = {
  // The image URL to display. When null/undefined, the lightbox is
  // closed — the parent owns the open/close state via this prop so
  // it can also gate the trigger affordance (don't make the avatar
  // clickable when there's no image).
  imageUrl: string | null | undefined;
  alt?: string;
  onClose: () => void;
};

// WhatsApp-style image preview: full-screen dark backdrop, image
// centered, dismiss on backdrop click / Esc / X. Used by the public
// lawyer profile so a client can see the avatar full-size.
export default function ImageLightbox({
  imageUrl,
  alt = "Image preview",
  onClose,
}: ImageLightboxProps) {
  // Esc-to-close + scroll lock. Both effects only run while the
  // lightbox is actually open so we don't leak listeners or freeze
  // the underlying page scroll forever.
  useEffect(() => {
    if (!imageUrl) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [imageUrl, onClose]);

  if (!imageUrl) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      {/* Centered card — not full-viewport. stopPropagation so
          clicking the card itself doesn't dismiss; only backdrop /
          close-button / Esc should close it. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl bg-white p-3 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="absolute -right-3 -top-3 rounded-full bg-white p-1.5 text-gray-700 shadow-md ring-1 ring-gray-200 transition hover:bg-gray-50"
        >
          <X className="h-4 w-4" />
        </button>

        <img
          src={imageUrl}
          alt={alt}
          className="block w-full rounded-xl object-contain"
          draggable={false}
        />
      </div>
    </div>
  );
}
