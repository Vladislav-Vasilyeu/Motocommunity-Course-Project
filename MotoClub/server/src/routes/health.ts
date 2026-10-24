import { Router } from "express";
import { prisma } from "../db/client.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.json({ status: "ok", service: "motoclub-api", database: "connected" });
  } catch {
    response.status(503).json({
      status: "degraded",
      service: "motoclub-api",
      database: "disconnected",
    });
  }
});
