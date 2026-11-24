import "../src/load-env.js";
import { prisma } from "../src/db/client.js";
import { hashPassword } from "../src/lib/auth.js";

const demo = await prisma.user.upsert({
  where: { email: "demo@motoclub.local" },
  update: {},
  create: {
    email: "demo@motoclub.local",
    displayName: "Александр Волков",
    passwordHash: await hashPassword("RideSafe2026!"),
    profile: { create: { city: "Минск", ridingStyle: "Туринг", bio: "Люблю длинные маршруты и спокойный темп." } },
  },
});
const rider2 = await prisma.user.upsert({
  where: { email: "ilya@motoclub.local" },
  update: {},
  create: {
    email: "ilya@motoclub.local",
    displayName: "Илья Романов",
    passwordHash: await hashPassword("RideSafe2026!"),
    profile: { create: { city: "Минск", ridingStyle: "Туринг" } },
  },
});
const rider3 = await prisma.user.upsert({
  where: { email: "marina@motoclub.local" },
  update: {},
  create: {
    email: "marina@motoclub.local",
    displayName: "Марина Коваль",
    passwordHash: await hashPassword("RideSafe2026!"),
    profile: { create: { city: "Минск", ridingStyle: "Город и туринг" } },
  },
});

const community1 = await prisma.community.upsert({
  where: { id: "community-minsk" },
  update: {},
  create: { id: "community-minsk", ownerId: rider2.id, name: "Мотоклуб Минск", description: "Встречи, городские маршруты и совместные выезды по выходным.", city: "Минск" },
});
await prisma.community.upsert({
  where: { id: "community-touring" },
  update: {},
  create: { id: "community-touring", ownerId: rider3.id, name: "Туринг Беларусь", description: "Дальние поездки, подготовка техники и полезные остановки.", city: "Беларусь" },
});
for (const [communityId, userId] of [[community1.id, demo.id], [community1.id, rider2.id], [community1.id, rider3.id]]) {
  await prisma.communityMember.upsert({ where: { communityId_userId: { communityId, userId } }, update: {}, create: { communityId, userId } });
}

await prisma.motorcycle.upsert({ where: { id: "motorcycle-demo" }, update: {}, create: { id: "motorcycle-demo", ownerId: demo.id, make: "Yamaha", model: "Tracer 7", year: 2022, mileage: 18400 } });
await prisma.motorcycle.upsert({ where: { id: "motorcycle-rider2" }, update: {}, create: { id: "motorcycle-rider2", ownerId: rider2.id, make: "Honda", model: "CB650R", year: 2021, mileage: 12600 } });

await prisma.post.upsert({
  where: { id: "post-route-minsk" }, update: {},
  create: { id: "post-route-minsk", authorId: rider2.id, content: "Нашёл отличный маршрут через Логойск и Плещеницы. Асфальт хороший, машин мало — добавил остановку у озера. Кто хочет прокатиться в субботу?" },
});
await prisma.post.upsert({
  where: { id: "post-service-minsk" }, update: {},
  create: { id: "post-service-minsk", authorId: rider3.id, communityId: community1.id, content: "После зимнего ТО заменила цепь и колодки. Если кто-то ищет хороший сервис в районе Уручья — подскажу контакты." },
});

await prisma.listing.upsert({
  where: { id: "listing-cb650r" }, update: {},
  create: { id: "listing-cb650r", sellerId: rider2.id, title: "Honda CB650R, 2021", description: "Один владелец, сервисная история, бережная эксплуатация.", category: "Мотоциклы", price: 27500, condition: "used", city: "Минск" },
});
await prisma.listing.upsert({
  where: { id: "listing-jacket" }, update: {},
  create: { id: "listing-jacket", sellerId: rider3.id, title: "Куртка REV’IT! Sand 4", description: "Размер L, защита в комплекте. Надевалась несколько раз.", category: "Экипировка", price: 790, condition: "used", city: "Гродно" },
});

const trip = await prisma.trip.upsert({
  where: { id: "trip-naroch" }, update: {},
  create: {
    id: "trip-naroch", organizerId: rider2.id, title: "Субботний круг: Минск — Нарочь",
    description: "Спокойный темп, остановка на кофе и обед у озера. Подходит для любого класса.",
    startsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    waypoints: { create: [
      { sequence: 1, latitude: 53.9, longitude: 27.56, label: "Минск" },
      { sequence: 2, latitude: 54.9, longitude: 26.7, label: "Нарочь" },
    ] },
  },
});
await prisma.tripParticipant.upsert({ where: { tripId_userId: { tripId: trip.id, userId: demo.id } }, update: {}, create: { tripId: trip.id, userId: demo.id } });

await prisma.place.upsert({
  where: { id: "place-minsk-meetup" }, update: {},
  create: { id: "place-minsk-meetup", creatorId: demo.id, name: "Точка сбора на МКАД", category: "Точка встречи", city: "Минск", latitude: 53.9, longitude: 27.56, description: "Удобно встретиться перед загородным выездом." },
});
await prisma.place.upsert({
  where: { id: "place-naroch-cafe" }, update: {},
  create: { id: "place-naroch-cafe", creatorId: rider2.id, name: "Кафе у озера", category: "Кафе", city: "Нарочь", latitude: 54.9, longitude: 26.7, description: "Парковка рядом и тёплый кофе." },
});

// Extend the local demonstration without replacing existing user changes.
const scenicRoute = await prisma.route.upsert({
  where: { id: "route-demo-naroch" }, update: {},
  create: {
    id: "route-demo-naroch", authorId: rider2.id, title: "К озеру через Логойск",
    description: "Дорога для спокойного выезда с остановкой на кофе.",
    waypoints: { create: [
      { position: 1, title: "Минск", latitude: 53.9, longitude: 27.56 },
      { position: 2, title: "Логойск", latitude: 54.2, longitude: 27.85 },
      { position: 3, title: "Нарочь", latitude: 54.9, longitude: 26.7 },
    ] },
  },
});
await prisma.routeFavorite.upsert({
  where: { routeId_userId: { routeId: scenicRoute.id, userId: demo.id } },
  update: {}, create: { routeId: scenicRoute.id, userId: demo.id },
});
await prisma.listingFavorite.upsert({
  where: { listingId_userId: { listingId: "listing-jacket", userId: demo.id } },
  update: {}, create: { listingId: "listing-jacket", userId: demo.id },
});
await prisma.maintenanceRecord.upsert({
  where: { id: "maintenance-demo-oil" }, update: {},
  create: { id: "maintenance-demo-oil", motorcycleId: "motorcycle-demo", title: "Замена масла и фильтра",
    date: new Date("2026-11-01T00:00:00.000Z"), mileage: 18000, cost: 125, notes: "Следующая проверка через 6000 км." },
});
const [userAId, userBId] = [demo.id, rider2.id].sort();
const dialog = await prisma.dialog.upsert({
  where: { userAId_userBId: { userAId, userBId } },
  update: {}, create: { userAId, userBId },
});
await prisma.message.upsert({
  where: { id: "message-demo-ride" }, update: {},
  create: { id: "message-demo-ride", dialogId: dialog.id, senderId: rider2.id, recipientId: demo.id,
    content: "Привет! Встречаемся перед поездкой у точки сбора. Возьми дождевик." },
});
await prisma.notification.upsert({
  where: { id: "notification-demo-message" }, update: {},
  create: { id: "notification-demo-message", recipientId: demo.id, actorId: rider2.id, type: "NEW_MESSAGE" },
});
if (process.env.SEED_DEMO_MODERATOR === "1") {
  await prisma.user.upsert({
    where: { email: "moderator@motoclub.local" }, update: {},
    create: { email: "moderator@motoclub.local", displayName: "Модератор Moto Club", role: "MODERATOR",
      passwordHash: await hashPassword("RideSafe2026!"), profile: { create: { city: "Минск" } } },
  });
}

console.log("MotoClub demo data is ready.");
await prisma.$disconnect();
