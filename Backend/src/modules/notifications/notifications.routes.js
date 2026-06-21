import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validateRequest } from "../../middleware/validateRequest.js";

import {
  deleteMyNotification,
  listMyNotifications,
  markAllMyNotificationsRead,
  markMyNotificationRead,
  getMyNotificationPreferences,
  updateMyNotificationPreferences
} from "./notifications.controller.js";
import {
  notificationIdParamValidator,
  updatePreferencesValidator
} from "./notifications.validators.js";

const router = Router();

// Every notification route is for the logged-in user acting on their OWN
// rows — any authenticated role qualifies (clients, lawyers, registrars,
// admins all have a bell). No authorizeRoles gate: ownership is enforced in
// the service by scoping every query to req.user.sub.
router.use(authenticate);

// GET /api/notifications -> { notifications, unreadCount }
router.get("/", asyncHandler(listMyNotifications));

// Email preferences (literal path — declared before the "/:id" routes so it's
// never captured as an id). GET returns current prefs; PUT upserts a patch.
router.get("/preferences", asyncHandler(getMyNotificationPreferences));
router.put(
  "/preferences",
  updatePreferencesValidator,
  validateRequest,
  asyncHandler(updateMyNotificationPreferences)
);

// PATCH /api/notifications/read-all -> { updated }
// Declared before "/:id/read" so the literal "read-all" segment can never be
// captured as a :id param.
router.patch("/read-all", asyncHandler(markAllMyNotificationsRead));

// PATCH /api/notifications/:id/read -> { notification }
router.patch(
  "/:id/read",
  notificationIdParamValidator,
  validateRequest,
  asyncHandler(markMyNotificationRead)
);

// DELETE /api/notifications/:id -> { deleted: true }
router.delete(
  "/:id",
  notificationIdParamValidator,
  validateRequest,
  asyncHandler(deleteMyNotification)
);

export default router;
