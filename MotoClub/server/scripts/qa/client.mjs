import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const origin = process.env.QA_API_URL;
if (!origin || process.env.QA_ALLOW_WRITES !== '1') throw new Error('Set QA_API_URL and QA_ALLOW_WRITES=1 for a disposable test API.');
const url = new URL(origin);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('QA suites only support a local disposable API.');
export { assert, randomUUID };
export const password = 'Course-QA-2026!';
let cases = 0;
export function client() {
  let cookie = '';
  const request = async (method, path, body, expected = 200) => {
    const response = await fetch(new URL(path, origin), {
      method, redirect: 'manual',
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    request.lastResponse = response;
    const session = response.headers.getSetCookie().find(value => value.startsWith('motoclub_session='));
    if (session) cookie = session.split(';')[0];
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
    return data;
  };
  Object.defineProperty(request, 'cookie', { get: () => cookie, set: value => { cookie = value; } });
  return request;
}
export async function register(request, label = 'QA Rider') {
  return (await request('POST', '/api/auth/register', { email: `${randomUUID()}@example.test`, password, displayName: label }, 201)).user;
}
export async function test(name, fn) {
  await fn();
  cases++;
  console.log(`PASS ${name}`);
}
export function finish(suite) { console.log(JSON.stringify({ suite, passed: cases, status: 'PASS' })); }
