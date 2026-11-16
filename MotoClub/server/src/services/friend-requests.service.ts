import { prisma } from "../db/client.js";
import { Prisma } from "../generated/prisma/client.js";
import { createNotification } from "./notifications.service.js";

export async function sendFriendRequest(senderId: string, receiverId: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const receiver = await tx.user.findUnique({ where: { id: receiverId }, select: { id: true } });
        if (!receiver) return { status: "missing-user" as const };
        const [same, reverse, friendship] = await Promise.all([
          tx.friendRequest.findUnique({ where: { senderId_receiverId: { senderId, receiverId } } }),
          tx.friendRequest.findUnique({ where: { senderId_receiverId: { senderId: receiverId, receiverId: senderId } } }),
          tx.friendship.findFirst({ where: { OR: [
            { userAId: senderId, userBId: receiverId },
            { userAId: receiverId, userBId: senderId },
          ] } }),
        ]);
        if (friendship || same?.status === "PENDING" || reverse?.status === "PENDING") {
          return { status: "exists" as const };
        }
        const request = same
          ? await tx.friendRequest.update({ where: { id: same.id }, data: { status: "PENDING" } })
          : await tx.friendRequest.create({ data: { senderId, receiverId } });
        await createNotification(tx, "FRIEND_REQUEST", senderId, receiverId);
        return { status: "created" as const, request };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") return { status: "exists" as const };
        if (error.code === "P2034" && attempt < 2) continue;
      }
      throw error;
    }
  }
}

export async function respondToFriendRequest(receiverId: string, id: string, status: "ACCEPTED" | "DECLINED") {
  return prisma.$transaction(async (tx) => {
    const changed = await tx.friendRequest.updateManyAndReturn({
      where: { id, receiverId, status: "PENDING" },
      data: { status },
      select: { senderId: true },
    });
    const [request] = changed;
    if (!request) return false;
    if (status === "ACCEPTED") {
      await tx.friendship.create({ data: { userAId: request.senderId, userBId: receiverId } });
      await createNotification(tx, "FRIEND_REQUEST_ACCEPTED", receiverId, request.senderId);
    }
    return true;
  });
}
