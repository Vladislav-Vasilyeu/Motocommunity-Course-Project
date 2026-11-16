import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { listNotifications, readAllNotifications, readNotification } from "../services/notifications.service.js";

export const notificationsRouter = Router();

notificationsRouter.get("/api/notifications", requireAuth, async (request, response) => {
  response.json(await listNotifications(request.userId!));
});

notificationsRouter.patch("/api/notifications/read-all", requireAuth, async (request, response) => {
  await readAllNotifications(request.userId!);
  response.json({ unreadCount: 0 });
});

notificationsRouter.patch<{ id: string }>("/api/notifications/:id/read", requireAuth, async (request, response) => {
  const notification = await readNotification(request.userId!, request.params.id);
  if (!notification) {
    response.status(404).json({ error: { code: "NOT_FOUND", message: "Уведомление не найдено" } });
    return;
  }
  response.json({ notification });
});
