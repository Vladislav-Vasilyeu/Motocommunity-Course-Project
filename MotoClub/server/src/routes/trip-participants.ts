import { Router } from "express";
import { prisma } from "../db/client.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";

export const tripParticipantsRouter = Router();

tripParticipantsRouter.get<{ id: string }>("/api/trips/:id", optionalAuth, async (request, response, next) => {
  try {
    const trip = await prisma.trip.findFirst({
      where: { id: request.params.id, status: "PLANNED" },
      include: {
        organizer: { select: { id: true, displayName: true } },
        waypoints: { orderBy: { sequence: "asc" } },
        participants: { where: { userId: request.userId ?? "" }, select: { userId: true } },
        _count: { select: { participants: true } },
      },
    });
    if (!trip) {
      response.status(404).json({ error: { code: "NOT_FOUND", message: "Поездка не найдена" } });
      return;
    }
    const { participants, ...detail } = trip;
    response.json({ trip: { ...detail, isJoined: participants.length > 0 } });
  } catch (error) { next(error); }
});

tripParticipantsRouter.get<{ id: string }>("/api/trips/:id/participants", async (request, response, next) => {
  try {
    const trip = await prisma.trip.findUnique({
      where: { id: request.params.id },
      select: {
        organizer: { select: { id: true, displayName: true } },
        participants: {
          orderBy: [{ joinedAt: "asc" }, { userId: "asc" }],
          select: { joinedAt: true, user: { select: { id: true, displayName: true } } },
        },
      },
    });
    if (!trip) {
      response.status(404).json({ error: { code: "NOT_FOUND", message: "Поездка не найдена" } });
      return;
    }
    response.json(trip);
  } catch (error) { next(error); }
});

tripParticipantsRouter.delete<{ id: string; userId: string }>("/api/trips/:id/participants/:userId", requireAuth, async (request, response, next) => {
  try {
    const { id, userId } = request.params;
    const trip = await prisma.trip.findUnique({ where: { id }, select: { organizerId: true } });
    if (!trip) {
      response.status(404).json({ error: { code: "NOT_FOUND", message: "Поездка не найдена" } });
      return;
    }
    if (trip.organizerId !== request.userId) {
      response.status(403).json({ error: { code: "FORBIDDEN", message: "Управлять участниками может организатор поездки" } });
      return;
    }
    await prisma.tripParticipant.deleteMany({ where: { tripId: id, userId } });
    response.status(204).end();
  } catch (error) { next(error); }
});
