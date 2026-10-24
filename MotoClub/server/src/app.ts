import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/error-handler.js";
import { healthRouter } from "./routes/health.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" }));
  app.use(express.json());
  app.use(healthRouter);
  app.use((_request, response) => {
    response.status(404).json({
      error: { code: "NOT_FOUND", message: "Маршрут не найден" },
    });
  });
  app.use(errorHandler);

  return app;
}
