import multer from "multer";

import { ApiError } from "../utils/apiError.js";

// Single-file uploader for chat attachments — documents the two parties
// share, plus recorded voice notes. 15 MB cap: larger than case images
// because a short voice clip or a multi-page PDF can exceed 5 MB, but still
// bounded so one message can't push a huge file through.
const maxFileSizeBytes = 15 * 1024 * 1024;

// Closed allow-list: common document + image types, plus the audio
// containers browsers actually produce with MediaRecorder (webm/mp4/ogg)
// and a couple of common uploads (mpeg/wav). Anything else is rejected at
// the edge.
const allowedMimeTypes = new Set([
  // images
  "image/jpeg",
  "image/png",
  // documents
  "application/pdf",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  // audio (voice notes)
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
]);

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSizeBytes },
  fileFilter(_req, file, cb) {
    if (file.fieldname !== "file") {
      cb(new ApiError(400, `Unexpected upload field: ${file.fieldname}`));
      return;
    }

    // MediaRecorder often appends a codecs parameter, e.g.
    // "audio/webm;codecs=opus" — match on the base type before the ";".
    const baseType = (file.mimetype || "").split(";")[0].trim();
    if (!allowedMimeTypes.has(baseType)) {
      cb(
        new ApiError(
          400,
          "Attachment must be an image, PDF, Word document, or audio clip"
        )
      );
      return;
    }

    cb(null, true);
  },
});

const singleAttachment = uploader.single("file");

export function uploadChatAttachment(req, res, next) {
  singleAttachment(req, res, (err) => {
    if (!err) return next();

    if (err instanceof ApiError) return next(err);

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(
          new ApiError(400, "Attachment is too large. Maximum size is 15 MB.")
        );
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return next(new ApiError(400, `Unexpected upload field: ${err.field}`));
      }
      return next(new ApiError(400, `Upload failed: ${err.message}`));
    }

    return next(err);
  });
}
