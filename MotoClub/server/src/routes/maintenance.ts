import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createMaintenance, deleteMaintenance, listMaintenance, updateMaintenance } from "../services/maintenance.service.js";

export const maintenanceRouter = Router();
const path = "/api/motorcycles/:motorcycleId/maintenance";
const motorcycleNotFound = { error: { code: "NOT_FOUND", message: "Мотоцикл не найден" } };
const recordNotFound = { error: { code: "NOT_FOUND", message: "Запись обслуживания не найдена" } };
const invalidRecord = { error: { code: "INVALID_MAINTENANCE_RECORD", message: "Проверьте название, дату, пробег, стоимость и заметки" } };

function parseInput(body: unknown, partial: boolean) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const values = body as Record<string, unknown>;
  const title = typeof values.title === "string" ? values.title.trim() : undefined;
  const rawDate = values.date;
  const date = typeof rawDate === "string" && /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? new Date(rawDate + "T00:00:00.000Z")
    : undefined;
  const mileage = values.mileage;
  const cost = values.cost;
  const notes = typeof values.notes === "string" ? values.notes.trim() || null : values.notes;

  if ((!partial || "title" in values) && (!title || title.length > 120)) return null;
  if ((!partial || "date" in values) && (!date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== rawDate)) return null;
  if (mileage != null && (typeof mileage !== "number" || !Number.isInteger(mileage) || mileage < 0 || mileage > 2147483647)) return null;
  if (cost != null && (typeof cost !== "number" || cost < 0 || cost > 9999999999.99 || !/^\d+(\.\d{1,2})?$/.test(String(cost)))) return null;
  if (notes != null && (typeof notes !== "string" || notes.length > 2000)) return null;

  const data = { title, date, mileage, cost, notes };
  return Object.values(data).some((value) => value !== undefined) ? data : null;
}

maintenanceRouter.get<{ motorcycleId: string }>(path, requireAuth, async (request, response) => {
  const result = await listMaintenance(request.userId!, request.params.motorcycleId);
  if (!result) {
    response.status(404).json(motorcycleNotFound);
    return;
  }
  response.json(result);
});

maintenanceRouter.post<{ motorcycleId: string }>(path, requireAuth, async (request, response) => {
  const input = parseInput(request.body, false);
  if (!input?.title || !input.date) {
    response.status(400).json(invalidRecord);
    return;
  }
  const record = await createMaintenance(request.userId!, request.params.motorcycleId, {
    title: input.title,
    date: input.date,
    mileage: input.mileage ?? null,
    cost: input.cost ?? null,
    notes: input.notes ?? null,
  });
  if (!record) {
    response.status(404).json(motorcycleNotFound);
    return;
  }
  response.status(201).json({ record });
});

maintenanceRouter.patch<{ motorcycleId: string; recordId: string }>(path + "/:recordId", requireAuth, async (request, response) => {
  const data = parseInput(request.body, true);
  if (!data) {
    response.status(400).json(invalidRecord);
    return;
  }
  const record = await updateMaintenance(request.userId!, request.params.motorcycleId, request.params.recordId, data);
  if (!record) {
    response.status(404).json(recordNotFound);
    return;
  }
  response.json({ record });
});

maintenanceRouter.delete<{ motorcycleId: string; recordId: string }>(path + "/:recordId", requireAuth, async (request, response) => {
  if (!await deleteMaintenance(request.userId!, request.params.motorcycleId, request.params.recordId)) {
    response.status(404).json(recordNotFound);
    return;
  }
  response.status(204).end();
});
