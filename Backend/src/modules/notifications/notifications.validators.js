import { body, param } from "express-validator";

// PATCH /api/notifications/:id/read — the id must be a real UUID before we
// hit the DB. Rejecting obvious garbage at the edge keeps query logs clean;
// the user_id-scoped UPDATE in the service is still the authoritative gate
// (it 404s on any id that isn't the caller's own row).
export const notificationIdParamValidator = [
  param("id").isUUID().withMessage("id must be a valid UUID")
];

// PUT /api/notifications/preferences — every field is an OPTIONAL boolean; the
// service merges the patch onto the user's current prefs (or the all-true
// defaults). Unknown keys are ignored by the service's sanitiser.
// `strict: true` so only genuine JSON booleans pass — without it
// express-validator also accepts the strings "true"/"false"/"1"/"0", which the
// service's sanitiser then silently drops (typeof !== "boolean"), giving a
// misleading 200 "Preferences updated" for a no-op.
export const updatePreferencesValidator = [
  body("emailEnabled").optional().isBoolean({ strict: true }).withMessage("emailEnabled must be true or false"),
  body("case").optional().isBoolean({ strict: true }).withMessage("case must be true or false"),
  body("hearing").optional().isBoolean({ strict: true }).withMessage("hearing must be true or false"),
  body("message").optional().isBoolean({ strict: true }).withMessage("message must be true or false"),
  body("document").optional().isBoolean({ strict: true }).withMessage("document must be true or false"),
  body("payment").optional().isBoolean({ strict: true }).withMessage("payment must be true or false")
];
