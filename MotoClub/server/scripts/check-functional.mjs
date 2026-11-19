import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Run only against a disposable database seeded with SEED_DEMO_MODERATOR=1.
const origin = process.env.SMOKE_API_URL;
if (!origin || !process.env.SMOKE_ALLOW_WRITES) throw new Error("Set SMOKE_API_URL and SMOKE_ALLOW_WRITES=1 for the isolated test instance.");
function client() {
  let cookie = "";
  return async (method, path, body, expected = 200) => {
    const response = await fetch(new URL(path, origin), {
      method,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const session = response.headers.getSetCookie().find(value => value.startsWith("motoclub_session="));
    if (session) cookie = session.split(";")[0];
    const data = response.status === 204 ? null : await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
    return data;
  };
}
const guest = client(), owner = client(), other = client(), moderator = client();
const registration = name => ({ email: `${randomUUID()}@example.test`, password: "Course-check-2026!", displayName: name });
await owner("POST", "/api/auth/register", registration("Тест владелец"), 201);
const peer = (await other("POST", "/api/auth/register", registration("Тест участник"), 201)).user;
await moderator("POST", "/api/auth/login", { email: "moderator@motoclub.local", password: "RideSafe2026!" });
const post = (await owner("POST", "/api/posts", { content: "Контент для проверки модерации" }, 201)).post;
await guest("GET", "/api/reports", undefined, 401);
await owner("GET", "/api/moderation/reports", undefined, 403);
const report = (await other("POST", "/api/reports", { targetType: "POST", targetId: post.id, reason: "Проверка жалобы на публикацию" }, 201)).report;
assert((await other("GET", "/api/reports")).reports.some(item => item.id === report.id));
assert(!(await owner("GET", "/api/reports")).reports.some(item => item.id === report.id));
const queue = await moderator("GET", "/api/moderation/reports");
assert(queue.reports.some(item => item.id === report.id));
await moderator("PATCH", `/api/moderation/reports/${report.id}`, { action: "DELETE_TARGET", note: "Проверено на тестовой базе" });
assert(!(await guest("GET", "/api/posts")).posts.some(item => item.id === post.id));
const bike = (await owner("POST", "/api/motorcycles", { make: "Honda", model: "CB500", year: 2020, mileage: 1000 }, 201)).motorcycle;
const journal = `/api/motorcycles/${bike.id}/maintenance`;
const record = (await owner("POST", journal, { title: "Замена масла", date: "2026-11-19", cost: 42.50 }, 201)).record;
await other("GET", journal, undefined, 404);
assert.equal((await owner("PATCH", `${journal}/${record.id}`, { mileage: 1200 })).record.mileage, 1200);
await owner("DELETE", `${journal}/${record.id}`, undefined, 204);
const route = (await owner("POST", "/api/routes", { title: "Маршрут проверки", waypoints: [
  { title: "Старт", latitude: 53.9, longitude: 27.56 }, { title: "Финиш", latitude: 54, longitude: 27.7 },
] }, 201)).route;
await owner("PUT", `/api/routes/${route.id}/favorite`, undefined, 204);
assert((await owner("GET", "/api/routes?favorite=true")).routes.some(item => item.id === route.id));
assert(!(await other("GET", "/api/routes?favorite=true")).routes.some(item => item.id === route.id));
await owner("POST", `/api/dialogs/${peer.id}/messages`, { content: "Сообщение тестового сценария" }, 201);
assert((await other("GET", "/api/dialogs")).dialogs.length);
assert((await other("GET", "/api/notifications")).unreadCount > 0);
await other("PATCH", "/api/notifications/read-all");
assert.equal((await other("GET", "/api/notifications")).unreadCount, 0);
console.log("PASS: reports/moderation, ownership, route favorites, messages and notifications");
