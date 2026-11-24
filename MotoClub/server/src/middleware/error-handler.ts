import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({ error: { code: "INVALID_JSON", message: "Тело запроса должно быть корректным JSON" } });
    return;
  }

  if (error && typeof error === "object" && error.type === "entity.too.large") {
    response.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Размер запроса превышает допустимый лимит" } });
    return;
  }

  console.error(error);
  response.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Внутренняя ошибка сервера",
    },
  });
};
