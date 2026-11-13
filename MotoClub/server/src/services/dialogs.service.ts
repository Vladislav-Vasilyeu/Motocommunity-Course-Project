import { prisma } from "../db/client.js";

const userSummary = { id: true, displayName: true };
const messageFields = { id: true, senderId: true, recipientId: true, content: true, createdAt: true };
const newestFirst = [{ createdAt: "desc" as const }, { id: "desc" as const }];
const pageSize = 50;

function dialogPair(first: string, second: string) {
  const [userAId, userBId] = [first, second].sort();
  return { userAId, userBId };
}

export async function listDialogs(userId: string) {
  const dialogs = await prisma.dialog.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    include: {
      userA: { select: userSummary },
      userB: { select: userSummary },
      messages: { select: messageFields, orderBy: newestFirst, take: 1 },
    },
  });
  return dialogs.flatMap((dialog) => {
    const lastMessage = dialog.messages[0];
    return lastMessage ? [{ user: dialog.userAId === userId ? dialog.userB : dialog.userA, lastMessage }] : [];
  });
}

export async function getDialogHistory(userId: string, peerId: string, cursor?: string) {
  const pair = dialogPair(userId, peerId);
  const [user, dialog] = await Promise.all([
    prisma.user.findUnique({ where: { id: peerId }, select: userSummary }),
    prisma.dialog.findUnique({ where: { userAId_userBId: pair }, select: { id: true } }),
  ]);
  if (!user) return { status: "missing-user" as const };
  if (!dialog) return cursor
    ? { status: "invalid-cursor" as const }
    : { status: "ok" as const, user, messages: [], nextCursor: null };

  const anchor = cursor && await prisma.message.findFirst({
    where: { id: cursor, dialogId: dialog.id },
    select: { id: true, createdAt: true },
  });
  if (cursor && !anchor) return { status: "invalid-cursor" as const };
  const messages = await prisma.message.findMany({
    where: {
      dialogId: dialog.id,
      ...(anchor ? { OR: [
        { createdAt: { lt: anchor.createdAt } },
        { createdAt: anchor.createdAt, id: { lt: anchor.id } },
      ] } : {}),
    },
    select: messageFields,
    orderBy: newestFirst,
    take: pageSize + 1,
  });
  const page = messages.slice(0, pageSize);
  return {
    status: "ok" as const, user,
    nextCursor: messages.length > pageSize ? page[page.length - 1].id : null,
    messages: page.reverse(),
  };
}

export async function sendMessage(senderId: string, recipientId: string, content: string) {
  const pair = dialogPair(senderId, recipientId);
  return prisma.$transaction(async (tx) => {
    const recipient = await tx.user.findUnique({ where: { id: recipientId }, select: { id: true } });
    if (!recipient) return null;
    await tx.dialog.createMany({ data: pair, skipDuplicates: true });
    const dialog = await tx.dialog.update({
      where: { userAId_userBId: pair },
      data: { updatedAt: new Date() },
      select: { id: true },
    });
    return tx.message.create({
      data: { dialogId: dialog.id, senderId, recipientId, content },
      select: messageFields,
    });
  });
}
