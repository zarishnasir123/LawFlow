import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { X, ZoomIn, ZoomOut } from "lucide-react";

// Instagram-style circular crop UI for avatar uploads.
//
// Flow: caller hands us the raw File picked from the OS file dialog, we render
// react-easy-crop with cropShape="round" + aspect=1 so the user can pan / zoom
// until the desired circular region sits inside the crop window. On Apply, we
// draw the selected region onto an offscreen canvas, export as a PNG Blob, and
// hand it back to the caller which uploads it. Cancel closes without uploading.
//
// We only ever send the cropped region (not the full image), so storage stays
// small AND the user gets WYSIWYG.

interface AvatarCropperModalProps {
  // Source file picked from the OS dialog. Modal mounts when non-null.
  file: File | null;
  // Fired with the cropped PNG blob after Apply. Caller uploads + closes.
  onConfirm: (croppedBlob: Blob) => void;
  // Fired on Cancel / X / backdrop / Escape.
  onClose: () => void;
}

// Read a File into a data URL the Cropper can consume directly. Data URLs are
// same-origin so they don't taint the offscreen canvas (toBlob() stays allowed).
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

// Crop the source image to the selected pixel region and return a PNG Blob.
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

  // Decode each new file into a data URL. State (image, crop, zoom, error) is
  // updated inside the async callback rather than synchronously in the effect
  // body — keeps each new file centered without tripping set-state-in-effect.
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    readFileAsDataUrl(file)
      .then((url) => {
        if (cancelled) return;
        setError(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setImageSrc(url);
      })
      .catch(() => {
        if (!cancelled) setError("Could not read the selected file.");
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Close on Escape, except while an export is in flight.
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

        {/* Crop area — fixed square so the round mask is a perfect circle. */}
        <div
          className="relative w-full bg-gray-900"
          style={{ aspectRatio: "1 / 1" }}
        >
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

        {/* Zoom slider */}
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
