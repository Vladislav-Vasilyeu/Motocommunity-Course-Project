import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getDialogHistory, listDialogs, sendMessage } from "../services/dialogs.service.js";

export const dialogsRouter = Router();

dialogsRouter.get("/api/dialogs", requireAuth, async (request, response) => {
  response.json({ dialogs: await listDialogs(request.userId!) });
});

dialogsRouter.get<{ userId: string }>("/api/dialogs/:userId/messages", requireAuth, async (request, response) => {
  if (request.params.userId === request.userId) {
    response.status(400).json({ error: { code: "INVALID_DIALOG", message: "Выберите другого пользователя" } });
    return;
  }
  const cursor = request.query.cursor;
  if (cursor !== undefined && (typeof cursor !== "string" || !cursor || cursor.length > 64)) {
    response.status(400).json({ error: { code: "INVALID_CURSOR", message: "Некорректная позиция истории" } });
    return;
  }
  const result = await getDialogHistory(request.userId!, request.params.userId, cursor);
  if (result.status === "missing-user") {
    response.status(404).json({ error: { code: "NOT_FOUND", message: "Пользователь не найден" } });
    return;
  }
  if (result.status === "invalid-cursor") {
    response.status(400).json({ error: { code: "INVALID_CURSOR", message: "Некорректная позиция истории" } });
    return;
  }
  const { user, messages, nextCursor } = result;
  response.json({ user, messages, nextCursor });
});

dialogsRouter.post<{ userId: string }>("/api/dialogs/:userId/messages", requireAuth, async (request, response) => {
  if (request.params.userId === request.userId) {
    response.status(400).json({ error: { code: "INVALID_DIALOG", message: "Выберите другого пользователя" } });
    return;
  }
  const content = typeof request.body?.content === "string" ? request.body.content.trim() : "";
  if (!content || content.length > 2000) {
    response.status(400).json({ error: { code: "INVALID_MESSAGE", message: "Введите от 1 до 2000 символов" } });
    return;
  }
  const message = await sendMessage(request.userId!, request.params.userId, content);
  if (!message) {
    response.status(404).json({ error: { code: "NOT_FOUND", message: "Пользователь не найден" } });
    return;
  }
  response.status(201).json({ message });
});
