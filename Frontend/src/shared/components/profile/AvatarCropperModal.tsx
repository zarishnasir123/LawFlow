import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { X, ZoomIn, ZoomOut } from "lucide-react";

// Instagram-style circular crop UI for avatar uploads.
//
// Flow: caller hands us the raw File picked from the OS file dialog,
// we render react-easy-crop with cropShape="round" + aspect=1 so the
// user can pan / zoom until the desired circular region of the image
// sits inside the crop window. On Apply, we draw the selected region
// onto an offscreen canvas, export as a PNG Blob, and hand it back to
// the caller which uploads it. Cancel just closes without uploading.
//
// We never send the original full-size image to the backend — only
// the cropped region — so the storage footprint stays small AND the
// user gets WYSIWYG: the avatar circle on the profile page shows
// exactly the pixels they selected.

interface AvatarCropperModalProps {
  // Source file picked from the OS dialog. Modal mounts when this
  // becomes non-null; unmount on null. We read it into an object URL
  // for the Cropper preview.
  file: File | null;
  // Fired with the cropped PNG blob after the user clicks Apply.
  // Caller is responsible for uploading + closing the modal.
  onConfirm: (croppedBlob: Blob) => void;
  // Fired when the user clicks Cancel, the X, the backdrop, or hits
  // Escape — basically every dismiss path.
  onClose: () => void;
}

// Read a File into a data URL the Cropper can consume directly. We
// use a data URL (not a blob: URL) so cross-origin canvas reads don't
// taint the offscreen canvas — same-origin data URLs always allow
// toBlob().
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// Decode a data URL into an HTMLImageElement we can draw to canvas.
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

// Crop the source image to the pixel region the user selected and
// return it as a PNG Blob. We use PNG (not JPEG) because the avatar
// gets rendered on a colored background — PNG keeps edges crisp and
// supports any future transparent uploads.
async function cropToBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas export failed"));
      },
      "image/png",
      0.95
    );
  });
}

export default function AvatarCropperModal({
  file,
  onConfirm,
  onClose,
}: AvatarCropperModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Whenever a new file is handed in, decode it into a data URL. We
  // reset crop + zoom so each new picked file starts from a clean
  // centered state — otherwise the user's last-session pan/zoom
  // leaks into the next image and looks wrong.
  useEffect(() => {
    if (!file) {
      setImageSrc(null);
      return;
    }
    let cancelled = false;
    setError(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    readFileAsDataUrl(file)
      .then((url) => {
        if (!cancelled) setImageSrc(url);
      })
      .catch(() => {
        if (!cancelled) setError("Could not read the selected file.");
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Close on Escape — standard modal affordance. Skip while processing
  // so a stray keystroke doesn't cancel an in-flight crop export.
  useEffect(() => {
    if (!file) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !processing) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [file, onClose, processing]);

  const onCropComplete = useCallback(
    (_croppedArea: Area, croppedAreaPixelsValue: Area) => {
      setCroppedAreaPixels(croppedAreaPixelsValue);
    },
    []
  );

  const handleApply = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setProcessing(true);
    setError(null);
    try {
      const blob = await cropToBlob(imageSrc, croppedAreaPixels);
      onConfirm(blob);
    } catch {
      setError("Failed to crop the image. Please try a different file.");
    } finally {
      setProcessing(false);
    }
  };

  if (!file) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      onClick={() => {
        if (!processing) onClose();
      }}
    >
      <div
        className="relative w-full max-w-md rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-base font-semibold text-gray-900">
            Adjust profile picture
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            aria-label="Close"
            className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Crop area. Fixed-aspect square inside the modal so the
            round mask is always a perfect circle. The Cropper itself
            uses position:absolute internally and needs a positioned
            parent with a definite size — hence the inline aspect-square
            wrapper. */}
        <div className="relative w-full bg-gray-900" style={{ aspectRatio: "1 / 1" }}>
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              objectFit="contain"
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-gray-300">
              Loading image…
            </div>
          )}
        </div>

        {/* Zoom slider. The min/max range matches react-easy-crop's
            internal defaults; the icons hint at the direction without
            needing labels. */}
        <div className="flex items-center gap-3 border-t px-5 py-3">
          <ZoomOut size={16} className="text-gray-500" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            disabled={processing || !imageSrc}
            className="flex-1 accent-[#01411C]"
            aria-label="Zoom"
          />
          <ZoomIn size={16} className="text-gray-500" />
        </div>

        {error && (
          <div className="mx-5 mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={processing || !imageSrc || !croppedAreaPixels}
            className="rounded-md bg-[#01411C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#024a23] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {processing ? "Applying…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
