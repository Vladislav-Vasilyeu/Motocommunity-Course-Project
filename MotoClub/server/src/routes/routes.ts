import { Router } from "express";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { parseCoordinate } from "../lib/coordinates.js";
import { addRouteFavorite, createRoute, getRoute, listRoutes, removeRouteFavorite, type RouteInput } from "../services/routes.service.js";

export const routesRouter = Router();

function parseRoute(body: unknown): RouteInput | null {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (title.length < 4 || title.length > 120 || description.length > 2000 ||
      !Array.isArray(input.waypoints) || input.waypoints.length < 2 || input.waypoints.length > 30) return null;

  const waypoints: RouteInput["waypoints"] = [];
  for (const value of input.waypoints) {
    if (!value || typeof value !== "object") return null;
    const latitude = parseCoordinate(value.latitude, 90);
    const longitude = parseCoordinate(value.longitude, 180);
    const pointTitle = typeof value.title === "string" ? value.title.trim() : "";
    if (latitude === null || longitude === null || pointTitle.length > 100) return null;
    waypoints.push({ title: pointTitle, latitude, longitude });
  }
  return { title, description, waypoints };
}

routesRouter.get("/api/routes", optionalAuth, async (request, response) => {
  const favorite = request.query.favorite === "true";
  if (favorite && !request.userId) {
    response.status(401).json({ error: { code: "UNAUTHORIZED", message: "Войдите в аккаунт" } });
    return;
  }
  const query = typeof request.query.q === "string" ? request.query.q.trim().slice(0, 120) : "";
  response.json({ routes: await listRoutes(request.userId, favorite, query) });
});

routesRouter.post("/api/routes", requireAuth, async (request, response) => {
  const input = parseRoute(request.body);
  if (!input) {
    response.status(400).json({ error: { code: "INVALID_ROUTE", message: "Проверьте название, описание и точки маршрута" } });
    return;
  }
  response.status(201).json({ route: await createRoute(request.userId!, input) });
});

routesRouter.get<{ id: string }>("/api/routes/:id", optionalAuth, async (request, response) => {
  const route = await getRoute(request.params.id, request.userId);
  if (!route) {
    response.status(404).json({ error: { code: "NOT_FOUND", message: "Маршрут не найден" } });
    return;
  }
  response.json({ route });
});

routesRouter.put<{ id: string }>("/api/routes/:id/favorite", requireAuth, async (request, response) => {
  if (!await addRouteFavorite(request.params.id, request.userId!)) {
    response.status(404).json({ error: { code: "NOT_FOUND", message: "Маршрут не найден" } });
    return;
  }
  response.status(204).end();
});

routesRouter.delete<{ id: string }>("/api/routes/:id/favorite", requireAuth, async (request, response) => {
  await removeRouteFavorite(request.params.id, request.userId!);
  response.status(204).end();
});
