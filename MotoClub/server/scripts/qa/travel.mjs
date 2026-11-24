import { client, register, assert, randomUUID, test, finish } from './client.mjs';

// Writes synthetic data only to an explicitly enabled disposable local API.
const guest = client(), organizer = client(), rider = client(), outsider = client();
const owner = await register(organizer, 'QA Travel Organizer');
const member = await register(rider, 'QA Travel Rider');
await register(outsider, 'QA Travel Outsider');
const tag = randomUUID();
const points = [
  { title: 'Start', latitude: 53.9, longitude: 27.56 },
  { title: 'Stop', latitude: 54.2, longitude: 27.1 },
  { title: 'Finish', latitude: 54.9, longitude: 26.7 },
];
const routeInput = { title: `QA Route ${tag}`, description: `Search-${tag}`, waypoints: points };
const tripInput = { title: `QA Trip ${tag}`, description: 'Three ordered stops', startsAt: '2026-12-05T10:00:00.000Z', waypoints: points.map(({ title, ...p }) => ({ ...p, label: title })) };
const invalid = async (path, body, code) => assert.equal((await organizer('POST', path, body, 400)).error.code, code);
let route, trip, place;

await test('guest public catalogs and protected mutations', async () => {
  for (const path of ['/api/routes', '/api/places', '/api/trips']) {
    const response = await guest('GET', path); assert.ok(Array.isArray(Object.values(response)[0]));
    assert.equal((await guest('POST', path, {}, 401)).error.code, 'UNAUTHORIZED');
  }
  await guest('GET', '/api/routes?favorite=true', undefined, 401);
  await guest('PUT', `/api/routes/${randomUUID()}/favorite`, undefined, 401);
  await guest('POST', `/api/trips/${randomUUID()}/join`, undefined, 401);
  await guest('DELETE', `/api/trips/${randomUUID()}/membership`, undefined, 401);
  await guest('DELETE', `/api/trips/${randomUUID()}/participants/${member.id}`, undefined, 401);
});
await test('route create, author and ordered path persist in public detail', async () => {
  route = (await organizer('POST', '/api/routes', routeInput, 201)).route;
  assert.equal(route.author.id, owner.id); assert.equal(route.isFavorite, false);
  const detail = (await guest('GET', `/api/routes/${route.id}`)).route;
  assert.deepEqual(detail.waypoints.map(p => p.title), points.map(p => p.title));
  assert.deepEqual(detail.waypoints.map(p => p.position), [1, 2, 3]);
  assert.deepEqual(detail.waypoints.map(p => Number(p.latitude)), points.map(p => p.latitude));
  assert.equal(detail.isFavorite, false); assert.equal('favorites' in detail, false);
});
await test('route search by title/description and empty results', async () => {
  for (const q of [routeInput.title.toLowerCase(), routeInput.description]) {
    assert.ok((await guest('GET', `/api/routes?q=${encodeURIComponent(q)}`)).routes.some(r => r.id === route.id));
  }
  assert.deepEqual((await guest('GET', `/api/routes?q=${randomUUID()}`)).routes, []);
});
await test('route favorite concurrent idempotency and account isolation', async () => {
  await Promise.all([1, 2, 3].map(() => rider('PUT', `/api/routes/${route.id}/favorite`, undefined, 204)));
  assert.equal((await rider('GET', `/api/routes/${route.id}`)).route.isFavorite, true);
  assert.equal((await outsider('GET', `/api/routes/${route.id}`)).route.isFavorite, false);
  assert.ok((await rider('GET', '/api/routes?favorite=true')).routes.some(r => r.id === route.id));
  assert.deepEqual((await outsider('GET', '/api/routes?favorite=true')).routes, []);
  await outsider('DELETE', `/api/routes/${route.id}/favorite`, undefined, 204);
  assert.equal((await rider('GET', `/api/routes/${route.id}`)).route.isFavorite, true);
  await rider('DELETE', `/api/routes/${route.id}/favorite`, undefined, 204);
  await rider('DELETE', `/api/routes/${route.id}/favorite`, undefined, 204);
  assert.deepEqual((await rider('GET', '/api/routes?favorite=true')).routes, []);
});
await test('route missing entities use stable errors', async () => {
  const id = randomUUID(); await guest('GET', `/api/routes/${id}`, undefined, 404);
  await rider('PUT', `/api/routes/${id}/favorite`, undefined, 404);
});
await test('route validation rejects range, empty, null, boolean and malformed points', async () => {
  for (const waypoints of [[], [points[0]], Array(31).fill(points[0]), [null, points[1]], [{ ...points[0], latitude: 91 }, points[1]], [{ ...points[0], longitude: -181 }, points[1]], [{ ...points[0], latitude: '' }, points[1]], [{ ...points[0], latitude: null }, points[1]], [{ ...points[0], latitude: true }, points[1]]]) {
    await invalid('/api/routes', { ...routeInput, waypoints }, 'INVALID_ROUTE');
  }
  await invalid('/api/routes', { ...routeInput, title: 'a' }, 'INVALID_ROUTE');
});
await test('places expose usable map coordinates and category filter', async () => {
  place = (await organizer('POST', '/api/places', { name: `QA Place ${tag}`, category: `QA-${tag}`, city: 'Minsk', latitude: 0, longitude: 0, description: '<script>test</script>' }, 201)).place;
  const places = (await guest('GET', `/api/places?category=${encodeURIComponent(place.category.toLowerCase())}`)).places;
  assert.equal(places.length, 1); assert.equal(places[0].id, place.id);
  assert.equal(Number(places[0].latitude), 0); assert.equal(Number(places[0].longitude), 0);
  assert.equal(places[0].description, '<script>test</script>');
});
await test('place validation rejects invalid coordinate types and range', async () => {
  for (const latitude of [null, '', true, 91, 'NaN']) await invalid('/api/places', { name: 'QA Place', category: 'QA', latitude, longitude: 0 }, 'INVALID_PLACE');
});
await test('trip create, public detail and ordered path', async () => {
  trip = (await organizer('POST', '/api/trips', tripInput, 201)).trip;
  assert.equal(trip.organizer.id, owner.id);
  const detail = (await guest('GET', `/api/trips/${trip.id}`)).trip;
  assert.equal(detail.startsAt, tripInput.startsAt);
  assert.deepEqual(detail.waypoints.map(p => [Number(p.latitude), Number(p.longitude)]), tripInput.waypoints.map(p => [p.latitude, p.longitude]));
  assert.deepEqual(detail.waypoints.map(p => p.label), ['Start', 'Stop', 'Finish']);
  assert.deepEqual(detail.waypoints.map(p => p.sequence), [1, 2, 3]);
  assert.equal(detail.isJoined, false); assert.equal(detail._count.participants, 0);
  assert.ok((await guest('GET', '/api/trips')).trips.some(t => t.id === trip.id));
});
await test('trip malformed and out-of-range input rejected', async () => {
  for (const input of [{ title: 'a' }, { startsAt: 'not-a-date' }, { startsAt: null }, { waypoints: [] }, { waypoints: [tripInput.waypoints[0]] }, { waypoints: Array(31).fill(tripInput.waypoints[0]) }, { waypoints: [{ latitude: 91, longitude: 0 }, tripInput.waypoints[1]] }, { waypoints: [{ latitude: 0, longitude: -181 }, tripInput.waypoints[1]] }]) await invalid('/api/trips', { ...tripInput, ...input }, 'INVALID_TRIP');
});
await test('trip join concurrency does not duplicate membership', async () => {
  await Promise.all([1, 2, 3].map(() => rider('POST', `/api/trips/${trip.id}/join`, undefined, 204)));
  const detail = (await rider('GET', `/api/trips/${trip.id}`)).trip;
  assert.equal(detail.isJoined, true); assert.equal(detail._count.participants, 1);
  assert.equal((await outsider('GET', `/api/trips/${trip.id}`)).trip.isJoined, false);
  const list = await guest('GET', `/api/trips/${trip.id}/participants`);
  assert.equal(list.organizer.id, owner.id); assert.equal(list.participants.length, 1);
  assert.equal(list.participants[0].user.id, member.id);
  assert.deepEqual(Object.keys(list.participants[0].user).sort(), ['displayName', 'id']);
});
await test('only organizer removes participants', async () => {
  await outsider('DELETE', `/api/trips/${trip.id}/participants/${member.id}`, undefined, 403);
  await rider('DELETE', `/api/trips/${trip.id}/participants/${member.id}`, undefined, 403);
  assert.equal((await guest('GET', `/api/trips/${trip.id}`)).trip._count.participants, 1);
  await organizer('DELETE', `/api/trips/${trip.id}/participants/${member.id}`, undefined, 204);
  assert.equal((await rider('GET', `/api/trips/${trip.id}`)).trip.isJoined, false);
  await organizer('DELETE', `/api/trips/${trip.id}/participants/${member.id}`, undefined, 204);
});
await test('leave affects only own membership and is idempotent', async () => {
  await rider('POST', `/api/trips/${trip.id}/join`, undefined, 204);
  await outsider('DELETE', `/api/trips/${trip.id}/membership`, undefined, 204);
  assert.equal((await rider('GET', `/api/trips/${trip.id}`)).trip.isJoined, true);
  await rider('DELETE', `/api/trips/${trip.id}/membership`, undefined, 204);
  await rider('DELETE', `/api/trips/${trip.id}/membership`, undefined, 204);
  assert.equal((await guest('GET', `/api/trips/${trip.id}`)).trip._count.participants, 0);
});
await test('missing trip detail/join/participants return not found', async () => {
  const id = randomUUID();
  await guest('GET', `/api/trips/${id}`, undefined, 404);
  await guest('GET', `/api/trips/${id}/participants`, undefined, 404);
  await rider('POST', `/api/trips/${id}/join`, undefined, 404);
  await organizer('DELETE', `/api/trips/${id}/participants/${member.id}`, undefined, 404);
});
await test('trip null and malformed coordinate types rejected without server errors', async () => {
  for (const point of [null, [], {}, { latitude: null, longitude: 0 }, { latitude: '', longitude: 0 }, { latitude: true, longitude: 0 }, { latitude: 'NaN', longitude: 0 }]) {
    await invalid('/api/trips', { ...tripInput, waypoints: [point, tripInput.waypoints[1]] }, 'INVALID_TRIP');
  }
});
finish('travel');
