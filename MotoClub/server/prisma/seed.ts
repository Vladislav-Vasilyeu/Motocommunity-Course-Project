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
    displayName: "РР»СЊСЏ Р РѕРјР°РЅРѕРІ",
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
  create: { id: "community-touring", ownerId: rider3.id, name: "Туринг Беларусь", description: "Дальние поездки, подготовка техники и полезные остановки.", city: "Р‘РµР»Р°СЂСѓСЃСЊ" },
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

console.log("MotoClub demo data is ready.");
await prisma.$disconnect();
