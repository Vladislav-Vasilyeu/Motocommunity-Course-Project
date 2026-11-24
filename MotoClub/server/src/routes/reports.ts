import { Router, type ErrorRequestHandler } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ReportError, listReports, moderationQueue, reportActions, reportTargets, reviewReport, submitReport } from "../services/reports.service.js";
import type { ReportStatus, ReportTargetType } from "../generated/prisma/client.js";

export const reportsRouter = Router();
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

reportsRouter.get("/api/reports", requireAuth, async (request, response) => {
  response.json({ reports: await listReports(request.userId!) });
});
reportsRouter.post("/api/reports", requireAuth, async (request, response) => {
  const { targetType } = request.body ?? {};
  const targetId = text(request.body?.targetId), reason = text(request.body?.reason);
  if (!reportTargets.includes(targetType) || !targetId || targetId.length > 100 || reason.length < 5 || reason.length > 2000) throw new ReportError(400, "INVALID_REPORT", "Выберите объект и укажите причину жалобы (5–2000 символов)");
  response.status(201).json({ report: await submitReport(request.userId!, targetType as ReportTargetType, targetId, reason) });
});
reportsRouter.get("/api/moderation/reports", requireAuth, requireRole("MODERATOR", "ADMIN"), async (request, response) => {
  const status = request.query.status ?? "PENDING";
  if (typeof status !== "string" || !["PENDING", "RESOLVED", "DISMISSED", "ALL"].includes(status)) throw new ReportError(400, "INVALID_REPORT_STATUS", "Неизвестный статус жалобы");
  response.json({ reports: await moderationQueue(request.userId!, status === "ALL" ? undefined : status as ReportStatus) });
});
reportsRouter.patch("/api/moderation/reports/:id", requireAuth, requireRole("MODERATOR", "ADMIN"), async (request, response) => {
  const { action } = request.body ?? {}, note = text(request.body?.note);
  if (!reportActions.includes(action) || note.length > 1000) throw new ReportError(400, "INVALID_REPORT_ACTION", "Выберите действие; комментарий — не более 1000 символов");
  const id = String(request.params.id);
  response.json({ report: await reviewReport(request.userId!, id, action, note) });
});
const errors: ErrorRequestHandler = (error, _request, response, next) => {
  if (error instanceof ReportError) { response.status(error.status).json({ error: { code: error.code, message: error.message } }); return; }
  next(error);
};
reportsRouter.use(errors);
