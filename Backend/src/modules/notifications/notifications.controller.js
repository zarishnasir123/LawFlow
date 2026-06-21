import {
  deleteNotificationForUser,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead
} from "./notifications.service.js";
import {
  getNotificationPreferences,
  updateNotificationPreferences
} from "./notificationPreferences.service.js";

// req.user.sub is the caller's user id (JWT payload — see issueSessionTokens
// in auth.service.js). Every handler scopes its query to that id, so a user
// only ever lists / marks their OWN notifications.

// GET /api/notifications
export async function listMyNotifications(req, res) {
  const { notifications, unreadCount } = await listNotificationsForUser({
    userId: req.user.sub
  });

  return res.status(200).json({ notifications, unreadCount });
}

// PATCH /api/notifications/:id/read
export async function markMyNotificationRead(req, res) {
  const notification = await markNotificationRead({
    userId: req.user.sub,
    notificationId: req.params.id
  });

  return res.status(200).json({ notification });
}

// PATCH /api/notifications/read-all
export async function markAllMyNotificationsRead(req, res) {
  const { updated } = await markAllNotificationsRead({
    userId: req.user.sub
  });

  return res.status(200).json({ updated });
}

// DELETE /api/notifications/:id
export async function deleteMyNotification(req, res) {
  const result = await deleteNotificationForUser({
    userId: req.user.sub,
    notificationId: req.params.id
  });

  return res.status(200).json(result);
}

// GET /api/notifications/preferences -> { preferences }
export async function getMyNotificationPreferences(req, res) {
  const preferences = await getNotificationPreferences(req.user.sub);
  return res.status(200).json({ preferences });
}

// PUT /api/notifications/preferences -> { preferences }
export async function updateMyNotificationPreferences(req, res) {
  const preferences = await updateNotificationPreferences(req.user.sub, req.body);
  return res.status(200).json({ message: "Preferences updated", preferences });
}
