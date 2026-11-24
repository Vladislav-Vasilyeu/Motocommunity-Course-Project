import { client, register, assert, randomUUID, test, finish } from './client.mjs';

// Write only to a disposable local API. Accounts are unique on every invocation.
const a = client(), b = client(), c = client(), guest = client();
const alice = await register(a, 'Personal QA Alice');
const bob = await register(b, 'Personal QA Bob');
const carol = await register(c, 'Personal QA Carol');
const history = (peer) => `/api/dialogs/${peer}/messages`;
const notices = (req) => req('GET', '/api/notifications');
async function rejects(req, method, path, body, status, code) {
  const result = await req(method, path, body, status);
  assert.equal(result.error.code, code);
  assert.equal(typeof result.error.message, 'string');
}

await test('guest cannot access messages, maintenance or notifications', async () => {
  for (const [method, path, body] of [
    ['GET', '/api/dialogs'], ['GET', history(alice.id)], ['POST', history(alice.id), { content: 'private' }],
    ['GET', '/api/motorcycles/missing/maintenance'], ['POST', '/api/motorcycles/missing/maintenance', {}],
    ['PATCH', '/api/motorcycles/missing/maintenance/missing', {}], ['DELETE', '/api/motorcycles/missing/maintenance/missing'],
    ['GET', '/api/notifications'], ['PATCH', '/api/notifications/read-all'], ['PATCH', '/api/notifications/missing/read'],
  ]) await req401(method, path, body);
  async function req401(method, path, body) { await guest(method, path, body, 401); }
});

await test('message recipient, self-send, content and cursor validation', async () => {
  for (const content of ['', '   ', 'x'.repeat(2001), 123, null])
    await rejects(a, 'POST', history(bob.id), { content }, 400, 'INVALID_MESSAGE');
  await rejects(a, 'POST', history(alice.id), { content: 'self' }, 400, 'INVALID_DIALOG');
  await rejects(a, 'GET', history(alice.id), undefined, 400, 'INVALID_DIALOG');
  for (const peer of [randomUUID(), 'not-a-user']) {
    await rejects(a, 'POST', history(peer), { content: 'missing' }, 404, 'NOT_FOUND');
    await rejects(a, 'GET', history(peer), undefined, 404, 'NOT_FOUND');
  }
  for (const query of ['?cursor=', '?cursor=' + 'x'.repeat(65), '?cursor=a&cursor=b'])
    await rejects(a, 'GET', history(bob.id) + query, undefined, 400, 'INVALID_CURSOR');
  assert.deepEqual((await a('GET', history(bob.id))).messages, []);
  assert.equal((await notices(b)).unreadCount, 0);
});

const sent = [];
await test('send trims text, accepts 2000 characters and persists both directions', async () => {
  sent.push((await a('POST', history(bob.id), { content: '  first private  ' }, 201)).message);
  assert.equal(sent[0].content, 'first private');
  sent.push((await b('POST', history(alice.id), { content: 'x'.repeat(2000) }, 201)).message);
  assert.equal(sent[1].content.length, 2000);
  assert.deepEqual((await a('GET', history(bob.id))).messages, sent);
  assert.deepEqual((await b('GET', history(alice.id))).messages, sent);
});

await test('third party cannot discover messages or use another dialog cursor', async () => {
  assert.deepEqual((await c('GET', '/api/dialogs')).dialogs, []);
  assert.deepEqual((await c('GET', history(alice.id))).messages, []);
  await rejects(c, 'GET', history(alice.id) + '?cursor=' + sent[0].id, undefined, 400, 'INVALID_CURSOR');
  assert.equal((await notices(c)).unreadCount, 0);
});

await test('concurrent sends share one dialog and history pages have stable order and no duplicates', async () => {
  sent.push(...await Promise.all(Array.from({ length: 104 }, async (_, i) =>
    (await (i % 2 ? b : a)('POST', history(i % 2 ? alice.id : bob.id), { content: `page-${i}` }, 201)).message)));
  const expected = [...sent].sort((x, y) => x.createdAt.localeCompare(y.createdAt) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  let cursor, pages = [], cursors = new Set();
  do {
    const page = await a('GET', history(bob.id) + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''));
    assert.equal(page.messages.length, pages.length < 2 ? 50 : 6);
    assert.deepEqual(page.messages, [...page.messages].sort((x, y) => x.createdAt.localeCompare(y.createdAt) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0)));
    pages.unshift(page.messages);
    cursor = page.nextCursor;
    if (cursor) { assert.ok(!cursors.has(cursor)); cursors.add(cursor); }
  } while (cursor);
  assert.deepEqual(pages.flat(), expected);
  assert.equal(new Set(pages.flat().map(m => m.id)).size, 106);
  for (const [req, peer] of [[a, bob], [b, alice]]) {
    const dialogs = (await req('GET', '/api/dialogs')).dialogs;
    assert.equal(dialogs.length, 1);
    assert.equal(dialogs[0].user.id, peer.id);
    assert.deepEqual(dialogs[0].lastMessage, expected.at(-1));
  }
  const own = (await a('POST', history(carol.id), { content: 'separate' }, 201)).message;
  await rejects(a, 'GET', history(bob.id) + '?cursor=' + own.id, undefined, 400, 'INVALID_CURSOR');
  assert.equal((await a('GET', '/api/dialogs')).dialogs.length, 2);
  assert.deepEqual((await c('GET', history(alice.id))).messages, [own]);
});

const bike = (await a('POST', '/api/motorcycles', { make: 'QA', model: 'Private journal' }, 201)).motorcycle;
const bike2 = (await a('POST', '/api/motorcycles', { make: 'QA', model: 'Other journal' }, 201)).motorcycle;
const maintenance = `/api/motorcycles/${bike.id}/maintenance`;
const validRecord = { title: '  Oil service  ', date: '2024-02-29', mileage: 12345, cost: 125.35, notes: '  Private notes  ' };
let record;
await test('maintenance create/list preserves calendar date and decimal money', async () => {
  assert.deepEqual((await a('GET', maintenance)).records, []);
  record = (await a('POST', maintenance, validRecord, 201)).record;
  assert.equal(record.date, '2024-02-29');
  assert.equal(record.cost, 125.35);
  assert.equal(record.title, 'Oil service');
  assert.equal(record.notes, 'Private notes');
  assert.deepEqual((await a('GET', maintenance)).records, [record]);
});
await test('maintenance owner isolation covers every operation and wrong motorcycle', async () => {
  for (const [method, path, body] of [
    ['GET', maintenance], ['POST', maintenance, validRecord],
    ['PATCH', maintenance + '/' + record.id, { title: 'stolen' }], ['DELETE', maintenance + '/' + record.id],
    ['PATCH', `/api/motorcycles/${bike2.id}/maintenance/${record.id}`, { title: 'wrong bike' }],
    ['DELETE', `/api/motorcycles/${bike2.id}/maintenance/${record.id}`],
  ]) await rejects(b, method, path, body, 404, 'NOT_FOUND');
  await rejects(a, 'PATCH', `/api/motorcycles/${bike2.id}/maintenance/${record.id}`, { title: 'wrong bike' }, 404, 'NOT_FOUND');
  await rejects(a, 'DELETE', `/api/motorcycles/${bike2.id}/maintenance/${record.id}`, undefined, 404, 'NOT_FOUND');
  assert.deepEqual((await a('GET', maintenance)).records, [record]);
  const profile = await guest('GET', `/api/users/${alice.id}`);
  assert.ok(!JSON.stringify(profile).includes('Private notes'));
});
await test('maintenance validates title/date/mileage/money/notes on create and patch', async () => {
  for (const invalid of [
    { title: '' }, { title: 'x'.repeat(121) }, { date: '2023-02-29' }, { date: '2024-04-31' },
    { date: '0000-01-01' }, { date: '2024-01-01T00:00:00Z' }, { date: 'bad' },
    { mileage: -1 }, { mileage: 0.5 }, { mileage: 2147483648 }, { mileage: '100' },
    { cost: -1 }, { cost: 0.001 }, { cost: 10000000000 }, { cost: '10.00' },
    { notes: 'x'.repeat(2001) }, { notes: 123 },
  ]) {
    await rejects(a, 'POST', maintenance, { ...validRecord, ...invalid }, 400, 'INVALID_MAINTENANCE_RECORD');
    await rejects(a, 'PATCH', maintenance + '/' + record.id, invalid, 400, 'INVALID_MAINTENANCE_RECORD');
  }
  for (const body of [{}, [], { ignored: true }])
    await rejects(a, 'PATCH', maintenance + '/' + record.id, body, 400, 'INVALID_MAINTENANCE_RECORD');
  await rejects(a, 'PATCH', maintenance + '/' + record.id, null, 400, 'INVALID_JSON');
  assert.equal((await a('GET', maintenance)).records.length, 1);
});
await test('maintenance partial update, null clearing, ordering and deletion persist', async () => {
  let updated = (await a('PATCH', maintenance + '/' + record.id, { cost: 0, mileage: 0 })).record;
  assert.equal(updated.cost, 0); assert.equal(updated.mileage, 0); assert.equal(updated.title, record.title);
  updated = (await a('PATCH', maintenance + '/' + record.id, { cost: null, mileage: null, notes: ' ' })).record;
  assert.equal(updated.cost, null); assert.equal(updated.mileage, null); assert.equal(updated.notes, null);
  const newer = (await a('POST', maintenance, { title: 'Newer', date: '2025-01-01', cost: 9999999999.99 }, 201)).record;
  assert.equal(newer.cost, 9999999999.99);
  assert.deepEqual((await a('GET', maintenance)).records.map(r => r.id), [newer.id, record.id]);
  await a('DELETE', maintenance + '/' + record.id, undefined, 204);
  await rejects(a, 'PATCH', maintenance + '/' + record.id, { title: 'gone' }, 404, 'NOT_FOUND');
  await rejects(a, 'DELETE', maintenance + '/' + record.id, undefined, 404, 'NOT_FOUND');
  await a('DELETE', maintenance + '/' + newer.id, undefined, 204);
  assert.deepEqual((await a('GET', maintenance)).records, []);
});

await test('message notifications have correct recipient, actor, link and unread count', async () => {
  for (const [req, peer, count] of [[a, bob, 53], [b, alice, 53], [c, alice, 1]]) {
    const result = await notices(req);
    assert.equal(result.unreadCount, count);
    assert.equal(result.notifications.length, count);
    assert.equal(result.unreadCount, result.notifications.filter(n => !n.readAt).length);
    for (const n of result.notifications) {
      assert.equal(n.type, 'NEW_MESSAGE'); assert.equal(n.actor.id, peer.id);
      assert.equal(n.link, `/messages/${peer.id}`); assert.equal(n.readAt, null);
    }
  }
});
await test('friend request and acceptance notifications point to friends', async () => {
  const request = (await a('POST', `/api/friend-requests/${bob.id}`, undefined, 201)).request;
  let notification = (await notices(b)).notifications.find(n => n.type === 'FRIEND_REQUEST');
  assert.equal(notification.actor.id, alice.id); assert.equal(notification.link, '/friends');
  await b('POST', `/api/friend-requests/${request.id}/respond`, { status: 'accept' });
  notification = (await notices(a)).notifications.find(n => n.type === 'FRIEND_REQUEST_ACCEPTED');
  assert.equal(notification.actor.id, bob.id); assert.equal(notification.link, '/friends');
});
await test('read one is owner-only, idempotent, persistent and updates unread filtering/count', async () => {
  const before = await notices(b), id = before.notifications[0].id;
  await rejects(a, 'PATCH', `/api/notifications/${id}/read`, undefined, 404, 'NOT_FOUND');
  await rejects(guest, 'PATCH', `/api/notifications/${id}/read`, undefined, 401, 'UNAUTHORIZED');
  const first = (await b('PATCH', `/api/notifications/${id}/read`)).notification;
  assert.ok(first.readAt);
  assert.equal((await b('PATCH', `/api/notifications/${id}/read`)).notification.readAt, first.readAt);
  const refreshed = client(); refreshed.cookie = b.cookie;
  const result = await notices(refreshed);
  assert.equal(result.unreadCount, before.unreadCount - 1);
  assert.equal(result.notifications.filter(n => !n.readAt).length, result.unreadCount);
  assert.equal(result.notifications.find(n => n.id === id).readAt, first.readAt);
  await rejects(b, 'PATCH', `/api/notifications/${randomUUID()}/read`, undefined, 404, 'NOT_FOUND');
});
await test('read-all remains isolated, persists and new events become unread', async () => {
  const aliceBefore = await notices(a), carolBefore = await notices(c);
  assert.equal((await b('PATCH', '/api/notifications/read-all')).unreadCount, 0);
  assert.equal((await notices(b)).unreadCount, 0);
  assert.ok((await notices(b)).notifications.every(n => n.readAt));
  assert.deepEqual(await notices(a), aliceBefore); assert.deepEqual(await notices(c), carolBefore);
  await a('POST', history(bob.id), { content: 'new after read-all' }, 201);
  const next = await notices(b);
  assert.equal(next.unreadCount, 1); assert.equal(next.notifications.filter(n => !n.readAt).length, 1);
  const refreshed = client(); refreshed.cookie = b.cookie;
  assert.deepEqual(await notices(refreshed), next);
});

await a('DELETE', `/api/motorcycles/${bike.id}`, undefined, 204);
await a('DELETE', `/api/motorcycles/${bike2.id}`, undefined, 204);
finish('personal');
