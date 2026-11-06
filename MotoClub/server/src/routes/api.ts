import { Router } from "express";
import { prisma } from "../db/client.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";

export const apiRouter = Router();
const take = 50;
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const optionalNumber = (value: unknown) => (value === "" || value == null ? null : Number(value));
const routeParam = (value: string | string[]) => Array.isArray(value) ? value[0] ?? "" : value;

apiRouter.get("/api/users", requireAuth, async (request, response, next) => {
  try {
    const query = String(request.query.search ?? "").trim();
    const users = await prisma.user.findMany({
      where: { id: { not: request.userId }, ...(query ? { OR: [{ displayName: { contains: query, mode: "insensitive" as const } }, { profile: { is: { city: { contains: query, mode: "insensitive" as const } } } }] } : {}) },
      select: { id: true, displayName: true, profile: { select: { city: true, ridingStyle: true } } },
      orderBy: { displayName: "asc" }, take: 20,
    });
    response.json({ users });
  } catch (error) { next(error); }
});

apiRouter.get("/api/users/:id", async (request, response, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: routeParam(request.params.id) },
      select: {
        id: true, displayName: true, createdAt: true, profile: true,
        motorcycles: { orderBy: { createdAt: "desc" }, select: { id: true, make: true, model: true, year: true } },
        _count: { select: { posts: true, friendshipsA: true, friendshipsB: true } },
      },
    });
    if (!user) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Профиль не найден" } }); return; }
    response.json({ user });
  } catch (error) { next(error); }
});

apiRouter.patch("/api/profile", requireAuth, async (request, response, next) => {
  try {
    const displayName = text(request.body?.displayName);
    const bio = text(request.body?.bio);
    const city = text(request.body?.city);
    const ridingStyle = text(request.body?.ridingStyle);
    if (displayName.length < 2 || displayName.length > 60 || bio.length > 500 || city.length > 100 || ridingStyle.length > 80) {
      response.status(400).json({ error: { code: "INVALID_PROFILE", message: "Проверьте длину полей профиля" } }); return;
    }
    const user = await prisma.user.update({
      where: { id: request.userId },
      data: { displayName, profile: { upsert: { create: { bio, city, ridingStyle }, update: { bio, city, ridingStyle } } } },
      select: { id: true, displayName: true, email: true, profile: true },
    });
    response.json({ user });
  } catch (error) { next(error); }
});

apiRouter.get("/api/motorcycles", requireAuth, async (request, response, next) => {
  try {
    const motorcycles = await prisma.motorcycle.findMany({ where: { ownerId: request.userId }, orderBy: { createdAt: "desc" } });
    response.json({ motorcycles });
  } catch (error) { next(error); }
});

apiRouter.post("/api/motorcycles", requireAuth, async (request, response, next) => {
  try {
    const make = text(request.body?.make); const model = text(request.body?.model);
    const year = optionalNumber(request.body?.year); const mileage = optionalNumber(request.body?.mileage);
    if (!make || !model || make.length > 60 || model.length > 80 || (year !== null && (!Number.isInteger(year) || year < 1885 || year > new Date().getFullYear() + 1)) || (mileage !== null && (!Number.isInteger(mileage) || mileage < 0))) {
      response.status(400).json({ error: { code: "INVALID_MOTORCYCLE", message: "Укажите марку и модель; проверьте год и пробег" } }); return;
    }
    const motorcycle = await prisma.motorcycle.create({ data: { ownerId: request.userId!, make, model, year, mileage } });
    response.status(201).json({ motorcycle });
  } catch (error) { next(error); }
});

apiRouter.patch("/api/motorcycles/:id", requireAuth, async (request, response, next) => {
  try {
    const existing = await prisma.motorcycle.findFirst({ where: { id: routeParam(request.params.id), ownerId: request.userId } });
    if (!existing) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Мотоцикл не найден" } }); return; }
    const make = text(request.body?.make); const model = text(request.body?.model);
    const year = optionalNumber(request.body?.year); const mileage = optionalNumber(request.body?.mileage);
    if (!make || !model || make.length > 60 || model.length > 80 || (year !== null && (!Number.isInteger(year) || year < 1885 || year > new Date().getFullYear() + 1)) || (mileage !== null && (!Number.isInteger(mileage) || mileage < 0))) {
      response.status(400).json({ error: { code: "INVALID_MOTORCYCLE", message: "Проверьте марку, модель, год и пробег" } }); return;
    }
    const motorcycle = await prisma.motorcycle.update({ where: { id: existing.id }, data: { make, model, year, mileage } });
    response.json({ motorcycle });
  } catch (error) { next(error); }
});

apiRouter.delete("/api/motorcycles/:id", requireAuth, async (request, response, next) => {
  try {
    const result = await prisma.motorcycle.deleteMany({ where: { id: routeParam(request.params.id), ownerId: request.userId } });
    if (!result.count) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Мотоцикл не найден" } }); return; }
    response.status(204).end();
  } catch (error) { next(error); }
});

apiRouter.get("/api/posts", async (request, response, next) => {
  try {
    const communityId = text(request.query.communityId);
    const posts = await prisma.post.findMany({
      where: communityId ? { communityId } : { communityId: null },
      include: { author: { select: { id: true, displayName: true, profile: { select: { city: true } } } }, community: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" }, take,
    });
    response.json({ posts });
  } catch (error) { next(error); }
});

apiRouter.post("/api/posts", requireAuth, async (request, response, next) => {
  try {
    const content = text(request.body?.content); const communityId = text(request.body?.communityId) || null;
    if (content.length < 1 || content.length > 2000) { response.status(400).json({ error: { code: "INVALID_POST", message: "Текст публикации должен содержать от 1 до 2000 символов" } }); return; }
    if (communityId && !await prisma.communityMember.findUnique({ where: { communityId_userId: { communityId, userId: request.userId! } } })) {
      response.status(403).json({ error: { code: "COMMUNITY_MEMBERSHIP_REQUIRED", message: "Вступите в сообщество, чтобы публиковать записи" } }); return;
    }
    const post = await prisma.post.create({ data: { content, authorId: request.userId!, communityId }, include: { author: { select: { id: true, displayName: true } } } });
    response.status(201).json({ post });
  } catch (error) { next(error); }
});

apiRouter.patch("/api/posts/:id", requireAuth, async (request, response, next) => {
  try {
    const content = text(request.body?.content);
    if (content.length < 1 || content.length > 2000) { response.status(400).json({ error: { code: "INVALID_POST", message: "Проверьте текст публикации" } }); return; }
    const changed = await prisma.post.updateMany({ where: { id: routeParam(request.params.id), authorId: request.userId }, data: { content } });
    if (!changed.count) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Публикация не найдена" } }); return; }
    response.json({ post: await prisma.post.findUnique({ where: { id: routeParam(request.params.id) }, include: { author: { select: { id: true, displayName: true } }, community: { select: { id: true, name: true } } } }) });
  } catch (error) { next(error); }
});

apiRouter.delete("/api/posts/:id", requireAuth, async (request, response, next) => {
  try {
    const changed = await prisma.post.deleteMany({ where: { id: routeParam(request.params.id), authorId: request.userId } });
    if (!changed.count) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Публикация не найдена" } }); return; }
    response.status(204).end();
  } catch (error) { next(error); }
});

apiRouter.get("/api/friends", requireAuth, async (request, response, next) => {
  try {
    const [friendsA, friendsB, requests] = await Promise.all([
      prisma.friendship.findMany({ where: { userAId: request.userId }, include: { userB: { select: { id: true, displayName: true, profile: true } } } }),
      prisma.friendship.findMany({ where: { userBId: request.userId }, include: { userA: { select: { id: true, displayName: true, profile: true } } } }),
      prisma.friendRequest.findMany({ where: { receiverId: request.userId, status: "PENDING" }, include: { sender: { select: { id: true, displayName: true } } } }),
    ]);
    response.json({ friends: [...friendsA.map((f) => f.userB), ...friendsB.map((f) => f.userA)], requests });
  } catch (error) { next(error); }
});

apiRouter.post("/api/friend-requests/:userId", requireAuth, async (request, response, next) => {
  try {
    const targetUserId = routeParam(request.params.userId);
    if (targetUserId === request.userId) { response.status(400).json({ error: { code: "INVALID_REQUEST", message: "Нельзя добавить себя в друзья" } }); return; }
    const receiver = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
    if (!receiver) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Пользователь не найден" } }); return; }
    const [same, reverse, friendship] = await Promise.all([
      prisma.friendRequest.findUnique({ where: { senderId_receiverId: { senderId: request.userId!, receiverId: receiver.id } } }),
      prisma.friendRequest.findUnique({ where: { senderId_receiverId: { senderId: receiver.id, receiverId: request.userId! } } }),
      prisma.friendship.findFirst({ where: { OR: [{ userAId: request.userId, userBId: receiver.id }, { userAId: receiver.id, userBId: request.userId }] } }),
    ]);
    if (friendship || same?.status === "PENDING" || reverse?.status === "PENDING") { response.status(409).json({ error: { code: "REQUEST_EXISTS", message: "Заявка уже отправлена или вы уже друзья" } }); return; }
    const friendRequest = same
      ? await prisma.friendRequest.update({ where: { id: same.id }, data: { status: "PENDING" } })
      : await prisma.friendRequest.create({ data: { senderId: request.userId!, receiverId: receiver.id } });
    response.status(201).json({ request: friendRequest });
  } catch (error) { next(error); }
});

apiRouter.post("/api/friend-requests/:id/respond", requireAuth, async (request, response, next) => {
  try {
    const status = request.body?.status === "accept" ? "ACCEPTED" : request.body?.status === "decline" ? "DECLINED" : null;
    if (!status) { response.status(400).json({ error: { code: "INVALID_STATUS", message: "Укажите accept или decline" } }); return; }
    const friendRequest = await prisma.friendRequest.findFirst({ where: { id: routeParam(request.params.id), receiverId: request.userId, status: "PENDING" } });
    if (!friendRequest) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Заявка не найдена" } }); return; }
    await prisma.$transaction(async (tx) => {
      await tx.friendRequest.update({ where: { id: friendRequest.id }, data: { status } });
      if (status === "ACCEPTED") await tx.friendship.create({ data: { userAId: friendRequest.senderId, userBId: friendRequest.receiverId } });
    });
    response.json({ status });
  } catch (error) { next(error); }
});

apiRouter.get("/api/communities", async (_request, response, next) => {
  try {
    const communities = await prisma.community.findMany({ orderBy: { createdAt: "desc" }, take, include: { _count: { select: { members: true, posts: true } } } });
    response.json({ communities });
  } catch (error) { next(error); }
});

apiRouter.get("/api/communities/:id", optionalAuth, async (request, response, next) => {
  try {
    const communityId = routeParam(request.params.id);
    const community = await prisma.community.findUnique({ where: { id: communityId }, include: { _count: { select: { members: true, posts: true } } } });
    if (!community) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Community not found" } }); return; }
    const membership = request.userId ? await prisma.communityMember.findUnique({ where: { communityId_userId: { communityId, userId: request.userId } }, select: { userId: true } }) : null;
    response.json({ community, isMember: Boolean(membership) });
  } catch (error) { next(error); }
});

apiRouter.post("/api/communities", requireAuth, async (request, response, next) => {
  try {
    const name = text(request.body?.name); const description = text(request.body?.description); const city = text(request.body?.city);
    if (name.length < 3 || name.length > 80 || description.length > 1000 || city.length > 100) { response.status(400).json({ error: { code: "INVALID_COMMUNITY", message: "Проверьте название и описание сообщества" } }); return; }
    const community = await prisma.community.create({ data: { name, description, city, ownerId: request.userId!, members: { create: { userId: request.userId! } } } });
    response.status(201).json({ community });
  } catch (error) { next(error); }
});

apiRouter.post("/api/communities/:id/join", requireAuth, async (request, response, next) => {
  try {
    const communityId = routeParam(request.params.id);
    await prisma.communityMember.upsert({ where: { communityId_userId: { communityId, userId: request.userId! } }, create: { communityId, userId: request.userId! }, update: {} });
    response.status(204).end();
  } catch (error) { next(error); }
});

apiRouter.delete("/api/communities/:id/membership", requireAuth, async (request, response, next) => {
  try {
    const communityId = routeParam(request.params.id);
    const community = await prisma.community.findUnique({ where: { id: communityId }, select: { ownerId: true } });
    if (!community) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Сообщество не найдено" } }); return; }
    if (community.ownerId === request.userId) { response.status(400).json({ error: { code: "OWNER_CANNOT_LEAVE", message: "Передайте права владельца перед выходом" } }); return; }
    await prisma.communityMember.deleteMany({ where: { communityId, userId: request.userId } });
    response.status(204).end();
  } catch (error) { next(error); }
});

apiRouter.get("/api/listings", async (request, response, next) => {
  try {
    const q = text(request.query.q); const category = text(request.query.category); const city = text(request.query.city);
    const listings = await prisma.listing.findMany({
      where: { status: "ACTIVE", ...(category ? { category } : {}), ...(city ? { city: { contains: city, mode: "insensitive" as const } } : {}), ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { description: { contains: q, mode: "insensitive" as const } }] } : {}) },
      orderBy: { createdAt: "desc" }, take, include: { seller: { select: { id: true, displayName: true, profile: { select: { city: true } } } } },
    });
    response.json({ listings });
  } catch (error) { next(error); }
});

apiRouter.post("/api/listings", requireAuth, async (request, response, next) => {
  try {
    const title = text(request.body?.title); const description = text(request.body?.description); const category = text(request.body?.category); const city = text(request.body?.city);
    const price = Number(request.body?.price); const condition = text(request.body?.condition) || "used";
    if (title.length < 4 || title.length > 120 || description.length > 3000 || !category || category.length > 40 || !Number.isFinite(price) || price < 0 || price > 999999999 || city.length > 100 || !["new", "used", "for-parts"].includes(condition)) {
      response.status(400).json({ error: { code: "INVALID_LISTING", message: "Проверьте название, категорию, состояние и цену" } }); return;
    }
    const listing = await prisma.listing.create({ data: { sellerId: request.userId!, title, description, category, city, price, condition }, include: { seller: { select: { id: true, displayName: true, profile: { select: { city: true } } } } } });
    response.status(201).json({ listing });
  } catch (error) { next(error); }
});

apiRouter.patch("/api/listings/:id", requireAuth, async (request, response, next) => {
  try {
    const existing = await prisma.listing.findFirst({ where: { id: routeParam(request.params.id), sellerId: request.userId } });
    if (!existing) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Объявление не найдено" } }); return; }
    const status = request.body?.status === "CLOSED" ? "CLOSED" : existing.status;
    const title = request.body?.title === undefined ? existing.title : text(request.body.title);
    const description = request.body?.description === undefined ? existing.description : text(request.body.description);
    const category = request.body?.category === undefined ? existing.category : text(request.body.category);
    const city = request.body?.city === undefined ? existing.city : text(request.body.city);
    const price = request.body?.price === undefined ? Number(existing.price) : Number(request.body.price);
    const condition = request.body?.condition === undefined ? existing.condition : text(request.body.condition);
    if (title.length < 4 || title.length > 120 || description.length > 3000 || !category || category.length > 40 || !Number.isFinite(price) || price < 0 || price > 999999999 || city.length > 100 || !["new", "used", "for-parts"].includes(condition)) {
      response.status(400).json({ error: { code: "INVALID_LISTING", message: "\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u043f\u043e\u043b\u044f \u043e\u0431\u044a\u044f\u0432\u043b\u0435\u043d\u0438\u044f" } }); return;
    }
    const listing = await prisma.listing.update({ where: { id: existing.id }, data: { title, description, category, city, price, condition, status }, include: { seller: { select: { id: true, displayName: true, profile: { select: { city: true } } } } } });
    response.json({ listing });
  } catch (error) { next(error); }
});

apiRouter.delete("/api/listings/:id", requireAuth, async (request, response, next) => {
  try {
    const result = await prisma.listing.deleteMany({ where: { id: routeParam(request.params.id), sellerId: request.userId } });
    if (!result.count) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Объявление не найдено" } }); return; }
    response.status(204).end();
  } catch (error) { next(error); }
});

apiRouter.get("/api/places", async (_request, response, next) => {
  try { response.json({ places: await prisma.place.findMany({ orderBy: { createdAt: "desc" }, take }) }); }
  catch (error) { next(error); }
});

apiRouter.post("/api/places", requireAuth, async (request, response, next) => {
  try {
    const name = text(request.body?.name); const category = text(request.body?.category); const city = text(request.body?.city);
    const latitude = Number(request.body?.latitude); const longitude = Number(request.body?.longitude);
    if (name.length < 2 || name.length > 100 || category.length < 2 || category.length > 40 || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      response.status(400).json({ error: { code: "INVALID_PLACE", message: "Проверьте название, категорию и координаты" } }); return;
    }
    const place = await prisma.place.create({ data: { creatorId: request.userId!, name, category, city, latitude, longitude, description: text(request.body?.description).slice(0, 1000) } });
    response.status(201).json({ place });
  } catch (error) { next(error); }
});

apiRouter.get("/api/trips", optionalAuth, async (request, response, next) => {
  try {
    const trips = await prisma.trip.findMany({ where: { status: "PLANNED" }, orderBy: { startsAt: "asc" }, take, include: { organizer: { select: { id: true, displayName: true } }, waypoints: { orderBy: { sequence: "asc" } }, participants: { where: { userId: request.userId ?? "" }, select: { userId: true } }, _count: { select: { participants: true } } } });
    response.json({ trips: trips.map(({ participants, ...trip }) => ({ ...trip, isJoined: participants.length > 0 })) });
  }
  catch (error) { next(error); }
});

apiRouter.post("/api/trips", requireAuth, async (request, response, next) => {
  try {
    const title = text(request.body?.title); const description = text(request.body?.description); const startsAt = new Date(request.body?.startsAt);
    const waypoints = Array.isArray(request.body?.waypoints) ? request.body.waypoints : [];
    if (title.length < 4 || title.length > 120 || description.length > 2000 || Number.isNaN(startsAt.valueOf()) || waypoints.length < 2 || waypoints.length > 30 || waypoints.some((p: { latitude?: unknown; longitude?: unknown }) => !Number.isFinite(Number(p.latitude)) || !Number.isFinite(Number(p.longitude)) || Number(p.latitude) < -90 || Number(p.latitude) > 90 || Number(p.longitude) < -180 || Number(p.longitude) > 180)) {
      response.status(400).json({ error: { code: "INVALID_TRIP", message: "Укажите название, дату и минимум две точки маршрута" } }); return;
    }
    const trip = await prisma.trip.create({ data: { organizerId: request.userId!, title, description, startsAt, waypoints: { create: waypoints.map((p: { latitude: number; longitude: number; label?: string }, i: number) => ({ sequence: i + 1, latitude: p.latitude, longitude: p.longitude, label: text(p.label).slice(0, 100) })) } }, include: { organizer: { select: { id: true, displayName: true } }, waypoints: { orderBy: { sequence: "asc" } }, _count: { select: { participants: true } } } });
    response.status(201).json({ trip });
  } catch (error) { next(error); }
});

apiRouter.post("/api/trips/:id/join", requireAuth, async (request, response, next) => {
  try {
    const tripId = routeParam(request.params.id);
    if (!await prisma.trip.findFirst({ where: { id: tripId, status: "PLANNED" } })) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Поездка не найдена" } }); return; }
    await prisma.tripParticipant.upsert({ where: { tripId_userId: { tripId, userId: request.userId! } }, create: { tripId, userId: request.userId! }, update: {} });
    response.status(204).end();
  } catch (error) { next(error); }
});

apiRouter.delete("/api/trips/:id/membership", requireAuth, async (request, response, next) => {
  try {
    await prisma.tripParticipant.deleteMany({ where: { tripId: routeParam(request.params.id), userId: request.userId } });
    response.status(204).end();
  } catch (error) { next(error); }
});
