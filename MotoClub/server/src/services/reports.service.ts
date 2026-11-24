import { prisma } from "../db/client.js";
import { Prisma, type ReportTargetType, type ReportStatus } from "../generated/prisma/client.js";

export class ReportError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export const reportTargets = ["USER", "POST", "LISTING", "COMMUNITY"] as const;
export const reportActions = ["DISMISS", "RESOLVE", "DELETE_TARGET"] as const;
export type ReportAction = typeof reportActions[number];

async function targetSummary(db: Prisma.TransactionClient, type: ReportTargetType, id: string) {
  if (type === "USER") { const row = await db.user.findUnique({ where: { id }, select: { displayName: true } }); return row?.displayName; }
  if (type === "POST") { const row = await db.post.findUnique({ where: { id }, select: { content: true } }); return row?.content.slice(0, 180); }
  if (type === "LISTING") { const row = await db.listing.findUnique({ where: { id }, select: { title: true } }); return row?.title; }
  const row = await db.community.findUnique({ where: { id }, select: { name: true } }); return row?.name;
}

export async function submitReport(reporterId: string, targetType: ReportTargetType, targetId: string, reason: string) {
  try {
    return await prisma.$transaction(async db => {
      const targetTitle = await targetSummary(db, targetType, targetId);
      if (!targetTitle) throw new ReportError(404, "REPORT_TARGET_NOT_FOUND", "Объект жалобы не найден");
      if (targetType === "USER" && targetId === reporterId) throw new ReportError(400, "REPORT_SELF", "Нельзя пожаловаться на себя");
      if (await db.report.findFirst({ where: { reporterId, targetType, targetId, status: "PENDING" }, select: { id: true } })) throw new ReportError(409, "REPORT_DUPLICATE", "Ваша жалоба на этот объект уже ожидает проверки");
      return db.report.create({ data: { reporterId, targetType, targetId, targetTitle, reason } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ReportError(409, "REPORT_DUPLICATE", "Ваша жалоба на этот объект уже ожидает проверки");
    throw error;
  }
}

export async function listReports(userId: string) {
  return prisma.report.findMany({ where: { reporterId: userId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 });
}

export async function requireModerator(userId: string) {
  const actor = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!actor || !["ADMIN", "MODERATOR"].includes(actor.role)) throw new ReportError(403, "FORBIDDEN", "Недостаточно прав");
}

export async function moderationQueue(userId: string, status?: ReportStatus) {
  await requireModerator(userId);
  return prisma.report.findMany({ where: status ? { status } : {}, include: { reporter: { select: { id: true, displayName: true } }, reviewer: { select: { id: true, displayName: true } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 100 });
}

export async function reviewReport(userId: string, id: string, action: ReportAction, note: string) {
  return prisma.$transaction(async db => {
    const actor = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!actor || !["ADMIN", "MODERATOR"].includes(actor.role)) throw new ReportError(403, "FORBIDDEN", "Недостаточно прав");
    const report = await db.report.findUnique({ where: { id } });
    if (!report) throw new ReportError(404, "REPORT_NOT_FOUND", "Жалоба не найдена");
    if (action === "DELETE_TARGET" && report.targetType === "USER") throw new ReportError(400, "REPORT_ACTION_UNAVAILABLE", "Удаление аккаунта через жалобу недоступно");
    const changed = await db.report.updateMany({ where: { id, status: "PENDING" }, data: { status: action === "DISMISS" ? "DISMISSED" : "RESOLVED", reviewerId: userId, reviewedAt: new Date(), action, note } });
    if (!changed.count) throw new ReportError(409, "REPORT_ALREADY_REVIEWED", "Жалоба уже обработана");
    if (action === "DELETE_TARGET") {
      if (report.targetType === "POST") await db.post.deleteMany({ where: { id: report.targetId } });
      if (report.targetType === "LISTING") await db.listing.deleteMany({ where: { id: report.targetId } });
      if (report.targetType === "COMMUNITY") await db.community.deleteMany({ where: { id: report.targetId } });
    }
    return db.report.findUniqueOrThrow({ where: { id } });
  });
}
