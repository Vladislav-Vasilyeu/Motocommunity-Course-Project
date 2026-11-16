import { prisma } from "../db/client.js";
import type { Prisma } from "../generated/prisma/client.js";
import type { NotificationType } from "../generated/prisma/enums.js";

const select = {
  id: true,
  type: true,
  createdAt: true,
  readAt: true,
  actor: { select: { id: true, displayName: true } },
} satisfies Prisma.NotificationSelect;

function serialize(notification: Prisma.NotificationGetPayload<{ select: typeof select }>) {
  const link = notification.type === "NEW_MESSAGE" ? "/messages/" + encodeURIComponent(notification.actor.id) : "/friends";
  return { ...notification, link };
}

export function createNotification(tx: Prisma.TransactionClient, type: NotificationType, actorId: string, recipientId: string) {
  return tx.notification.create({ data: { type, actorId, recipientId }, select: { id: true } });
}

export async function listNotifications(recipientId: string) {
  const notifications = await prisma.notification.findMany({
    where: { recipientId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select,
  });
  return { notifications: notifications.map(serialize), unreadCount: notifications.filter((notification) => !notification.readAt).length };
}

export async function readNotification(recipientId: string, id: string) {
  const notification = await prisma.$transaction(async (tx) => {
    await tx.notification.updateMany({ where: { id, recipientId, readAt: null }, data: { readAt: new Date() } });
    return tx.notification.findUnique({ where: { id, recipientId }, select });
  });
  return notification && serialize(notification);
}

export async function readAllNotifications(recipientId: string) {
  await prisma.notification.updateMany({ where: { recipientId, readAt: null }, data: { readAt: new Date() } });
}
