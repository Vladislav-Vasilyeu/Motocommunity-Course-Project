import { prisma } from "../db/client.js";

type Waypoint = { title: string; latitude: number; longitude: number };
export type RouteInput = { title: string; description: string; waypoints: Waypoint[] };

function routeDetails(userId?: string) {
  return {
    author: { select: { id: true, displayName: true } },
    waypoints: { orderBy: { position: "asc" as const } },
    favorites: { where: { userId: userId ?? "" }, select: { userId: true } },
  };
}

function withFavorite<T extends { favorites: { userId: string }[] }>({ favorites, ...route }: T) {
  return { ...route, isFavorite: favorites.length > 0 };
}

export async function listRoutes(userId: string | undefined, favorite: boolean, query: string) {
  const routes = await prisma.route.findMany({
    where: {
      ...(favorite ? { favorites: { some: { userId } } } : {}),
      ...(query ? { OR: [
        { title: { contains: query, mode: "insensitive" as const } },
        { description: { contains: query, mode: "insensitive" as const } },
      ] } : {}),
    },
    include: routeDetails(userId),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 50,
  });
  return routes.map(withFavorite);
}

export async function getRoute(id: string, userId?: string) {
  const route = await prisma.route.findUnique({ where: { id }, include: routeDetails(userId) });
  return route && withFavorite(route);
}

export async function createRoute(authorId: string, input: RouteInput) {
  const { waypoints, ...fields } = input;
  const route = await prisma.route.create({
    data: {
      ...fields, authorId,
      waypoints: { create: waypoints.map((point, index) => ({ ...point, position: index + 1 })) },
    },
    include: routeDetails(authorId),
  });
  return withFavorite(route);
}

export async function addRouteFavorite(routeId: string, userId: string) {
  if (!await prisma.route.findUnique({ where: { id: routeId }, select: { id: true } })) return false;
  await prisma.routeFavorite.createMany({ data: { routeId, userId }, skipDuplicates: true });
  return true;
}

export async function removeRouteFavorite(routeId: string, userId: string) {
  await prisma.routeFavorite.deleteMany({ where: { routeId, userId } });
}
