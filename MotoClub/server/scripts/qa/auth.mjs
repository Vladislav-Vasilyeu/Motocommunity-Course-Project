import { assert, client, register, randomUUID, password, test, finish } from './client.mjs';
const guest = client(), owner = client(), other = client();
let account;
await test('AUTH-01 guest session/profile mutations denied', async () => {
  await guest('GET', '/api/auth/me', undefined, 401);
  await guest('PATCH', '/api/profile', { displayName: 'QA Guest' }, 401);
});
await test('AUTH-02 registration validates email/name/password', async () => {
  const good = { email: `${randomUUID()}@example.test`, password, displayName: 'QA Rider' };
  for (const bad of [{ email: 'bad' }, { password: 'short' }, { password: 'x'.repeat(129) }, { displayName: 'x' }, { displayName: 'x'.repeat(61) }]) {
    const result = await guest('POST', '/api/auth/register', { ...good, ...bad }, 400);
    assert.equal(typeof result.error.code, 'string');
  }
});
await test('AUTH-03 account creation ignores role injection and uses protected cookie', async () => {
  account = (await owner('POST', '/api/auth/register', { email: ` ${randomUUID().toUpperCase()}@EXAMPLE.TEST `, password, displayName: '  QA Owner  ', role: 'ADMIN' }, 201)).user;
  assert.equal(account.role, 'USER');
  assert.equal(account.displayName, 'QA Owner');
  assert.equal(account.email, account.email.toLowerCase().trim());
  assert(!('passwordHash' in account));
  const cookie = owner.lastResponse.headers.getSetCookie().find(value => value.startsWith('motoclub_session='));
  assert(cookie.includes('HttpOnly') && cookie.includes('SameSite=Lax') && cookie.includes('Path=/'));
  assert.equal((await owner('GET', '/api/auth/me')).user.id, account.id);
});
await test('AUTH-04 duplicate email normalizes case', async () => {
  await guest('POST', '/api/auth/register', { email: account.email.toUpperCase(), password, displayName: 'QA Duplicate' }, 409);
});
await test('AUTH-05 wrong and unknown credentials denied', async () => {
  for (const email of [account.email, `${randomUUID()}@example.test`]) {
    const result = await guest('POST', '/api/auth/login', { email, password: 'Wrong-password!' }, 401);
    assert.equal(result.error.code, 'INVALID_CREDENTIALS');
  }
});
await test('AUTH-06 independent password login restores same user', async () => {
  const result = await other('POST', '/api/auth/login', { email: account.email.toUpperCase(), password });
  assert.equal(result.user.id, account.id);
  assert.equal((await other('GET', '/api/auth/me')).user.id, account.id);
});
await test('AUTH-07 malformed and tampered cookie denied', async () => {
  const invalid = client();
  invalid.cookie = 'motoclub_session=not.a.session';
  await invalid('GET', '/api/auth/me', undefined, 401);
  const [payload, signature] = owner.cookie.split('=')[1].split('.');
  invalid.cookie = `motoclub_session=${payload}.${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;
  await invalid('GET', '/api/auth/me', undefined, 401);
});
await test('AUTH-08 profile validation and persistence preserve role', async () => {
  await owner('PATCH', '/api/profile', { displayName: 'X' }, 400);
  const profile = { displayName: 'QA Updated', city: 'Минск', ridingStyle: 'Туринг', bio: 'Проверка профиля' };
  const updated = (await owner('PATCH', '/api/profile', { ...profile, role: 'ADMIN', id: 'different-user' })).user;
  assert.equal(updated.id, account.id);
  assert.equal(updated.role, 'USER');
  const persisted = (await owner('GET', '/api/auth/me')).user;
  assert.equal(persisted.displayName, profile.displayName);
  assert.equal(persisted.profile.bio, profile.bio);
  assert.equal(persisted.role, 'USER');
});
await test('AUTH-09 public profile exposes no credentials or email', async () => {
  const publicUser = (await guest('GET', `/api/users/${account.id}`)).user;
  for (const field of ['email', 'passwordHash', 'googleSubject']) assert(!(field in publicUser));
});
await test('AUTH-10 logout clears browser cookie and denies next access', async () => {
  await other('POST', '/api/auth/logout', undefined, 204);
  assert(other.lastResponse.headers.getSetCookie().some(value => value.includes('Expires=Thu, 01 Jan 1970')));
  await other('GET', '/api/auth/me', undefined, 401);
});
await test('AUTH-11 concurrent duplicate registration returns conflict', async () => {
  const email = `${randomUUID()}@example.test`;
  const payload = { email, password, displayName: 'QA Concurrent' };
  const statuses = await Promise.all([0, 1].map(() => fetch(new URL('/api/auth/register', process.env.QA_API_URL), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(r => r.status)));
  assert.deepEqual(statuses.sort(), [201, 409]);
});
await test('AUTH-12 malformed JSON and oversized JSON are client errors', async () => {
  const request = body => fetch(new URL('/api/auth/register', process.env.QA_API_URL), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  assert.equal((await request('{')).status, 400);
  assert.equal((await request(JSON.stringify({ displayName: 'x'.repeat(70000) }))).status, 413);
});
finish('auth-profile');
