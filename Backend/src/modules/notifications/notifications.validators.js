import { param } from "express-validator";

// PATCH /api/notifications/:id/read — the id must be a real UUID before we
// hit the DB. Rejecting obvious garbage at the edge keeps query logs clean;
// the user_id-scoped UPDATE in the service is still the authoritative gate
// (it 404s on any id that isn't the caller's own row).
export const notificationIdParamValidator = [
  param("id").isUUID().withMessage("id must be a valid UUID")
];
