import { client, register, assert, randomUUID, test, finish } from './client.mjs';

// Run only against the disposable local API; client.mjs enforces the opt-in.
const guest = client(), owner = client(), other = client(), third = client();
const marker = `social-${randomUUID()}`;
const failures = [];
let total = 0;
async function check(name, fn) {
  total++;
  try { await test(name, fn); }
  catch (error) { failures.push({ name, message: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}
async function error(req, method, path, body, status, code) {
  const result = await req(method, path, body, status);
  assert.equal(result.error.code, code);
  assert.equal(typeof result.error.message, 'string');
}
const has = (rows, id) => rows.some(row => row.id === id);
const a = await register(owner, `${marker}-A`);
const b = await register(other, `${marker}-B`);
const c = await register(third, `${marker}-C`);
let bike, post, community, clubPost, listing, rejected, accepted;
const bikeData = { make: 'Honda', model: marker, year: 2020, mileage: 1000 };
const listingData = { title: marker, description: `Helmet ${marker}`, category: 'equipment', city: 'Minsk', price: 120, condition: 'used' };

await check('guest public feed, communities, listings', async () => {
  for (const [path, key] of [['posts', 'posts'], ['communities', 'communities'], ['listings', 'listings']]) {
    assert.ok(Array.isArray((await guest('GET', `/api/${path}`))[key]));
  }
});
await check('guest protected reads and mutations', async () => {
  for (const path of ['/api/motorcycles', '/api/friends', '/api/users', '/api/listings/favorites']) await guest('GET', path, undefined, 401);
  for (const [path, body] of [['/api/motorcycles', bikeData], ['/api/posts', { content: marker }], ['/api/communities', { name: marker }], ['/api/listings', listingData], [`/api/friend-requests/${a.id}`, {}]]) await guest('POST', path, body, 401);
});
await check('garage initially private and empty', async () => assert.deepEqual((await owner('GET', '/api/motorcycles')).motorcycles, []));
await check('garage create and owner read', async () => {
  bike = (await owner('POST', '/api/motorcycles', bikeData, 201)).motorcycle;
  assert.equal(bike.ownerId, a.id);
  assert.ok(has((await owner('GET', '/api/motorcycles')).motorcycles, bike.id));
});
await check('garage foreign list/update/delete denied', async () => {
  assert.ok(!has((await other('GET', '/api/motorcycles')).motorcycles, bike.id));
  await error(other, 'PATCH', `/api/motorcycles/${bike.id}`, bikeData, 404, 'NOT_FOUND');
  await other('DELETE', `/api/motorcycles/${bike.id}`, undefined, 404);
});
await check('garage invalid create and update', async () => {
  for (const patch of [{ make: '' }, { year: 1884 }, { year: 2020.5 }, { mileage: -1 }, { mileage: 1.5 }]) {
    await error(owner, 'POST', '/api/motorcycles', { ...bikeData, ...patch }, 400, 'INVALID_MOTORCYCLE');
    await owner('PATCH', `/api/motorcycles/${bike.id}`, { ...bikeData, ...patch }, 400);
  }
});
await check('garage owner update persists', async () => {
  const updated = (await owner('PATCH', `/api/motorcycles/${bike.id}`, { ...bikeData, mileage: 2000 })).motorcycle;
  assert.equal(updated.mileage, 2000);
  assert.equal((await owner('GET', '/api/motorcycles')).motorcycles.find(row => row.id === bike.id).mileage, 2000);
});
await check('garage owner delete and repeat missing', async () => {
  await owner('DELETE', `/api/motorcycles/${bike.id}`, undefined, 204);
  assert.ok(!has((await owner('GET', '/api/motorcycles')).motorcycles, bike.id));
  await owner('DELETE', `/api/motorcycles/${bike.id}`, undefined, 404);
});
await check('post create and public feed', async () => {
  post = (await owner('POST', '/api/posts', { content: marker }, 201)).post;
  assert.equal(post.authorId, a.id);
  assert.ok(has((await guest('GET', '/api/posts')).posts, post.id));
});
await check('post invalid create/update', async () => {
  for (const content of ['', '  ', 'x'.repeat(2001)]) {
    await error(owner, 'POST', '/api/posts', { content }, 400, 'INVALID_POST');
    await owner('PATCH', `/api/posts/${post.id}`, { content }, 400);
  }
});
await check('post foreign update/delete denied', async () => {
  await other('PATCH', `/api/posts/${post.id}`, { content: 'hijack' }, 404);
  await other('DELETE', `/api/posts/${post.id}`, undefined, 404);
});
await check('post owner update persists', async () => {
  const content = `${marker} updated`;
  assert.equal((await owner('PATCH', `/api/posts/${post.id}`, { content })).post.content, content);
  assert.equal((await guest('GET', '/api/posts')).posts.find(row => row.id === post.id).content, content);
});
await check('post owner delete', async () => {
  await owner('DELETE', `/api/posts/${post.id}`, undefined, 204);
  assert.ok(!has((await guest('GET', '/api/posts')).posts, post.id));
});
await check('rider discovery and public profile', async () => {
  assert.ok(has((await owner('GET', `/api/users?search=${encodeURIComponent(marker)}`)).users, b.id));
  const result = await guest('GET', `/api/users/${b.id}`);
  assert.equal(result.user.id, b.id);
  assert.ok(!('passwordHash' in result.user));
});
await check('friends empty and requests isolated', async () => {
  const result = await owner('GET', '/api/friends');
  assert.deepEqual(result.friends, []); assert.deepEqual(result.requests, []);
});
await check('friend self and nonexistent receiver denied', async () => {
  await error(owner, 'POST', `/api/friend-requests/${a.id}`, {}, 400, 'INVALID_REQUEST');
  await owner('POST', `/api/friend-requests/${randomUUID()}`, {}, 404);
});
await check('friend request send and inbox', async () => {
  rejected = (await owner('POST', `/api/friend-requests/${b.id}`, {}, 201)).request;
  assert.ok(has((await other('GET', '/api/friends')).requests, rejected.id));
  assert.ok(!has((await third('GET', '/api/friends')).requests, rejected.id));
});
await check('friend duplicate and reverse request denied', async () => {
  await error(owner, 'POST', `/api/friend-requests/${b.id}`, {}, 409, 'REQUEST_EXISTS');
  await other('POST', `/api/friend-requests/${a.id}`, {}, 409);
});
await check('friend response validates action and recipient', async () => {
  await error(other, 'POST', `/api/friend-requests/${rejected.id}/respond`, { status: 'yes' }, 400, 'INVALID_STATUS');
  for (const req of [owner, third]) await req('POST', `/api/friend-requests/${rejected.id}/respond`, { status: 'accept' }, 404);
});
await check('friend decline creates no friendship', async () => {
  assert.equal((await other('POST', `/api/friend-requests/${rejected.id}/respond`, { status: 'decline' })).status, 'DECLINED');
  assert.deepEqual((await owner('GET', '/api/friends')).friends, []);
  assert.ok(!has((await other('GET', '/api/friends')).requests, rejected.id));
  await other('POST', `/api/friend-requests/${rejected.id}/respond`, { status: 'accept' }, 404);
});
await check('friend resend after decline then accept', async () => {
  accepted = (await owner('POST', `/api/friend-requests/${b.id}`, {}, 201)).request;
  assert.equal((await other('POST', `/api/friend-requests/${accepted.id}/respond`, { status: 'accept' })).status, 'ACCEPTED');
  assert.ok(has((await owner('GET', '/api/friends')).friends, b.id));
  assert.ok(has((await other('GET', '/api/friends')).friends, a.id));
  assert.deepEqual((await third('GET', '/api/friends')).friends, []);
});
await check('friend repeated accept and new friend request denied', async () => {
  await other('POST', `/api/friend-requests/${accepted.id}/respond`, { status: 'accept' }, 404);
  await owner('POST', `/api/friend-requests/${b.id}`, {}, 409);
});
await check('community invalid create', async () => {
  for (const body of [{ name: 'ab' }, { name: 'x'.repeat(81) }, { name: marker, description: 'x'.repeat(1001) }]) await error(owner, 'POST', '/api/communities', body, 400, 'INVALID_COMMUNITY');
});
await check('community creation includes owner membership', async () => {
  community = (await owner('POST', '/api/communities', { name: marker, description: marker, city: 'Minsk' }, 201)).community;
  const result = await owner('GET', `/api/communities/${community.id}`);
  assert.equal(result.isMember, true); assert.equal(result.community._count.members, 1);
  assert.equal((await guest('GET', `/api/communities/${community.id}`)).isMember, false);
  assert.ok(has((await guest('GET', '/api/communities')).communities, community.id));
});
await check('community missing detail and guest join rejected', async () => {
  await guest('GET', `/api/communities/${randomUUID()}`, undefined, 404);
  await guest('POST', `/api/communities/${community.id}/join`, {}, 401);
});
await check('community nonmember cannot publish', async () => {
  await error(other, 'POST', '/api/posts', { content: marker, communityId: community.id }, 403, 'COMMUNITY_MEMBERSHIP_REQUIRED');
});
await check('community owner publish edit and delete', async () => {
  const ownPost = (await owner('POST', '/api/posts', { content: marker, communityId: community.id }, 201)).post;
  assert.equal((await owner('PATCH', `/api/posts/${ownPost.id}`, { content: `${marker} owner edit` })).post.content, `${marker} owner edit`);
  await other('PATCH', `/api/posts/${ownPost.id}`, { content: 'hijack' }, 404);
  await owner('DELETE', `/api/posts/${ownPost.id}`, undefined, 204);
});
await check('community join idempotent and scoped to session', async () => {
  for (let i = 0; i < 2; i++) await other('POST', `/api/communities/${community.id}/join`, {}, 204);
  const result = await other('GET', `/api/communities/${community.id}`);
  assert.equal(result.isMember, true); assert.equal(result.community._count.members, 2);
  assert.equal((await third('GET', `/api/communities/${community.id}`)).isMember, false);
});
await check('community member publish separated from main feed', async () => {
  clubPost = (await other('POST', '/api/posts', { content: marker, communityId: community.id }, 201)).post;
  assert.ok(has((await guest('GET', `/api/posts?communityId=${community.id}`)).posts, clubPost.id));
  assert.ok(!has((await guest('GET', '/api/posts')).posts, clubPost.id));
  await owner('DELETE', `/api/posts/${clubPost.id}`, undefined, 404);
});
await check('community owner cannot leave', async () => error(owner, 'DELETE', `/api/communities/${community.id}/membership`, undefined, 400, 'OWNER_CANNOT_LEAVE'));
await check('community leave removes publish right, repeat is idempotent', async () => {
  for (let i = 0; i < 2; i++) await other('DELETE', `/api/communities/${community.id}/membership`, undefined, 204);
  assert.equal((await other('GET', `/api/communities/${community.id}`)).isMember, false);
  await other('POST', '/api/posts', { content: marker, communityId: community.id }, 403);
  await other('DELETE', `/api/posts/${clubPost.id}`, undefined, 204);
});
await check('community nonexistent join returns 404', async () => error(other, 'POST', `/api/communities/${randomUUID()}/join`, {}, 404, 'NOT_FOUND'));
await check('community concurrent join creates one membership', async () => {
  const fresh = (await owner('POST', '/api/communities', { name: `${marker}-race` }, 201)).community;
  await Promise.all(Array.from({ length: 3 }, () => other('POST', `/api/communities/${fresh.id}/join`, {}, 204)));
  const result = await other('GET', `/api/communities/${fresh.id}`);
  assert.equal(result.isMember, true);
  assert.equal(result.community._count.members, 2); // Owner plus exactly one joining member.
});
await check('listing create and guest discovery', async () => {
  listing = (await owner('POST', '/api/listings', listingData, 201)).listing;
  assert.equal(listing.sellerId, a.id);
  const rows = (await guest('GET', `/api/listings?q=${marker}`)).listings;
  assert.ok(has(rows, listing.id)); assert.equal(rows.find(row => row.id === listing.id).isFavorite, false);
});
await check('listing create and update validation', async () => {
  for (const patch of [{ title: 'abc' }, { price: -1 }, { price: 'NaN' }, { category: '' }, { condition: 'bad' }, { description: 'x'.repeat(3001) }]) {
    await error(owner, 'POST', '/api/listings', { ...listingData, ...patch }, 400, 'INVALID_LISTING');
    await owner('PATCH', `/api/listings/${listing.id}`, patch, 400);
  }
});
await check('listing foreign update/delete denied', async () => {
  await other('PATCH', `/api/listings/${listing.id}`, { title: 'Hijacked listing' }, 404);
  await other('DELETE', `/api/listings/${listing.id}`, undefined, 404);
});
await check('listing search category city and no matches', async () => {
  assert.ok(has((await guest('GET', `/api/listings?q=${marker.toUpperCase()}&category=equipment&city=MIN`)).listings, listing.id));
  for (const query of [`q=${marker}&category=motorcycles`, `q=${marker}&city=London`, `q=absent-${randomUUID()}`]) assert.deepEqual((await guest('GET', `/api/listings?${query}`)).listings, []);
});
await check('listing owner partial edit persists', async () => {
  const updated = (await owner('PATCH', `/api/listings/${listing.id}`, { price: 140, condition: 'new' })).listing;
  assert.equal(Number(updated.price), 140); assert.equal(updated.condition, 'new'); assert.equal(updated.title, marker);
});
await check('favorites add idempotent and private', async () => {
  for (let i = 0; i < 2; i++) assert.equal((await other('PUT', `/api/listings/${listing.id}/favorite`)).isFavorite, true);
  assert.deepEqual((await other('GET', '/api/listings/favorites')).listings.map(row => row.id), [listing.id]);
  assert.deepEqual((await third('GET', '/api/listings/favorites')).listings, []);
  assert.equal((await other('GET', `/api/listings?q=${marker}`)).listings[0].isFavorite, true);
  assert.equal((await third('GET', `/api/listings?q=${marker}`)).listings[0].isFavorite, false);
  assert.equal((await guest('GET', `/api/listings?q=${marker}`)).listings[0].isFavorite, false);
});
await check('favorites foreign removal affects only own session', async () => {
  await third('DELETE', `/api/listings/${listing.id}/favorite`);
  assert.ok(has((await other('GET', '/api/listings/favorites')).listings, listing.id));
});
await check('favorites support search and filters', async () => {
  assert.ok(has((await other('GET', `/api/listings/favorites?q=${marker}&category=equipment&city=min`)).listings, listing.id));
  assert.deepEqual((await other('GET', '/api/listings/favorites?category=motorcycles')).listings, []);
});
await check('favorites guest mutation and missing listing denied', async () => {
  await guest('PUT', `/api/listings/${listing.id}/favorite`, undefined, 401);
  await guest('DELETE', `/api/listings/${listing.id}/favorite`, undefined, 401);
  await error(other, 'PUT', `/api/listings/${randomUUID()}/favorite`, undefined, 404, 'NOT_FOUND');
});
await check('listing close hides public listing but preserves saved favorite', async () => {
  assert.equal((await owner('PATCH', `/api/listings/${listing.id}`, { status: 'CLOSED' })).listing.status, 'CLOSED');
  assert.deepEqual((await guest('GET', `/api/listings?q=${marker}`)).listings, []);
  assert.equal((await other('GET', '/api/listings/favorites')).listings.find(row => row.id === listing.id).status, 'CLOSED');
  await third('PUT', `/api/listings/${listing.id}/favorite`, undefined, 404);
});
await check('favorites remove idempotent', async () => {
  for (let i = 0; i < 2; i++) assert.equal((await other('DELETE', `/api/listings/${listing.id}/favorite`)).isFavorite, false);
  assert.deepEqual((await other('GET', '/api/listings/favorites')).listings, []);
});
await check('listing owner delete and repeat missing', async () => {
  await owner('DELETE', `/api/listings/${listing.id}`, undefined, 204);
  await owner('DELETE', `/api/listings/${listing.id}`, undefined, 404);
});
await check('guest edit delete and membership removal rejected', async () => {
  for (const [path, body] of [[`/api/motorcycles/${bike.id}`, bikeData], [`/api/posts/${post.id}`, { content: marker }], [`/api/listings/${listing.id}`, listingData]]) {
    await guest('PATCH', path, body, 401);
    await guest('DELETE', path, undefined, 401);
  }
  await guest('DELETE', `/api/communities/${community.id}/membership`, undefined, 401);
});
await check('missing owner resources reject update and delete', async () => {
  for (const [path, body] of [[`/api/motorcycles/${randomUUID()}`, bikeData], [`/api/posts/${randomUUID()}`, { content: marker }], [`/api/listings/${randomUUID()}`, listingData]]) {
    await owner('PATCH', path, body, 404);
    await owner('DELETE', path, undefined, 404);
  }
  await owner('DELETE', `/api/communities/${randomUUID()}/membership`, undefined, 404);
});

if (failures.length) {
  console.log(JSON.stringify({ suite: 'social', total, passed: total - failures.length, failed: failures.length, failures, marker }));
  process.exitCode = 1;
} else finish('social');
