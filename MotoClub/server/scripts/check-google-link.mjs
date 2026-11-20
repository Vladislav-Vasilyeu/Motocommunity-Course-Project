import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { once } from "node:events";
import { OAuth2Client } from "google-auth-library";

// Build first. Default: HTTP security checks without a database or Google access.
// Add GOOGLE_LINK_ALLOW_WRITES=1 to check real persistence with temporary users.
// Only users created by this run are deleted; seed and existing accounts are unused.
await import("../dist/load-env.js");
process.env.DATABASE_URL ||= "postgresql://unused:unused@127.0.0.1:1/unused";
process.env.AUTH_SECRET = `google-link-check-${randomUUID()}`;
process.env.NODE_ENV = "test";
process.env.CLIENT_ORIGIN = "http://localhost:5173";
process.env.GOOGLE_CLIENT_ID = "synthetic-google-client";
process.env.GOOGLE_CLIENT_SECRET = "synthetic-google-secret";
process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/auth/google/callback";

const { createApp } = await import("../dist/app.js");
const { createSessionToken } = await import("../dist/lib/auth.js");
const { prisma } = await import("../dist/db/client.js");
const { findOrCreateGoogleUser, googleIsLinked, linkGoogleUser } = await import("../dist/services/google-auth.service.js");
const server = createApp().listen(0, "127.0.0.1");
await once(server, "listening");
const origin = `http://127.0.0.1:${server.address().port}`;
const createdIds = [];
let tokenExchanges = 0;
let syntheticClaims;
const originalGetToken = OAuth2Client.prototype.getToken;
const originalVerifyIdToken = OAuth2Client.prototype.verifyIdToken;
OAuth2Client.prototype.getToken = async function () {
  tokenExchanges++;
  assert(syntheticClaims, "Rejected callbacks must stop before token exchange");
  return { tokens: { id_token: "synthetic-id-token" } };
};
OAuth2Client.prototype.verifyIdToken = async function () {
  return { getPayload: () => syntheticClaims };
};

const request = (path, cookie = "") => fetch(new URL(path, origin), {
  redirect: "manual", headers: cookie ? { Cookie: cookie } : {},
});
const sessionCookie = token => `motoclub_session=${token}`;
async function start(cookie = "", mode = "link") {
  const response = await request(`/api/auth/google/start?mode=${mode}`, cookie);
  assert.equal(response.status, 302);
  const url = new URL(response.headers.get("location"));
  const flow = response.headers.getSetCookie().find(value => value.startsWith("motoclub_google_flow="))?.split(";")[0];
  return { response, url, flow };
}
async function callback(flow, cookie, error, state = flow?.split("=")[1].split(".")[0]) {
  const response = await request(`/api/auth/google/callback?state=${state}&code=synthetic-code`, [flow, cookie].filter(Boolean).join("; "));
  assert.equal(response.status, 302);
  const url = new URL(response.headers.get("location"));
  assert.equal(url.pathname, "/settings");
  if (error) assert.equal(url.searchParams.get("googleError"), error);
  assert(!response.headers.getSetCookie().some(value => value.startsWith("motoclub_session=")), "Link must not replace the login session");
  return url;
}

try {
  assert.deepEqual(await (await request("/api/auth/google")).json(), { enabled: true, linked: false });
  const guestStart = await start();
  assert.equal(guestStart.url.searchParams.get("googleError"), "session_changed");
  assert.equal(guestStart.flow, undefined);

  const userId = randomUUID();
  const cookie = sessionCookie(createSessionToken(userId, "USER"));
  const flow = await start(cookie);
  assert.equal(flow.url.origin, "https://accounts.google.com");
  assert.equal(flow.url.searchParams.get("code_challenge_method"), "S256");
  assert(flow.url.searchParams.get("nonce"));
  assert.match(flow.response.headers.get("set-cookie"), /HttpOnly/);
  await callback(flow.flow, cookie, "expired", "bad-state");
  const expiredParts = flow.flow.split(".");
  expiredParts[4] = String(Date.now() - 11 * 60 * 1000);
  await callback(expiredParts.join("."), cookie, "expired");
  await callback(flow.flow, "", "session_changed");
  await callback(flow.flow, sessionCookie(createSessionToken(randomUUID(), "USER")), "session_changed");
  // A second valid signed session for the same account must also be rejected.
  const secondPayload = Buffer.from(JSON.stringify({ sub: userId, role: "USER", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  const secondSignature = createHmac("sha256", process.env.AUTH_SECRET).update(secondPayload).digest("base64url");
  await callback(flow.flow, sessionCookie(`${secondPayload}.${secondSignature}`), "session_changed");
  assert.equal(tokenExchanges, 0);
  console.log("PASS: guest status/start, PKCE/nonce, invalid/expired state, logout, account switch and same-user session replacement before token exchange");

  if (process.env.GOOGLE_LINK_ALLOW_WRITES !== "1") {
    console.log("SKIP: persistence/callback success checks; set GOOGLE_LINK_ALLOW_WRITES=1 with a reachable database");
  } else {
    async function createUser(label, googleSubject) {
      const user = await prisma.user.create({ data: {
        email: `google-link-${randomUUID()}@example.test`, displayName: `Google check ${label}`,
        passwordHash: "synthetic-unused-password", googleSubject,
      } });
      createdIds.push(user.id);
      return user;
    }
    const owner = await createUser("owner");
    const peer = await createUser("peer");
    const identity = { subject: `check-${randomUUID()}`, email: owner.email, displayName: "Synthetic Google" };
    assert.equal(await findOrCreateGoogleUser(identity), null, "Email collision must not silently link accounts");
    assert.equal(await googleIsLinked(owner.id), false);
    assert.equal(await linkGoogleUser(owner.id, { ...identity, email: peer.email }), "email_mismatch");
    assert.equal(await linkGoogleUser(randomUUID(), identity), "session_changed");

    const ownerCookie = sessionCookie(createSessionToken(owner.id, "USER"));
    assert.equal((await (await request("/api/auth/google", ownerCookie)).json()).linked, false);
    const linkFlow = await start(ownerCookie);
    syntheticClaims = { sub: identity.subject, email: owner.email, email_verified: true, name: identity.displayName, nonce: linkFlow.url.searchParams.get("nonce") };
    const success = await callback(linkFlow.flow, ownerCookie);
    assert.equal(success.searchParams.get("googleLinked"), "1");
    assert.equal((await (await request("/api/auth/google", ownerCookie)).json()).linked, true);
    assert.equal((await findOrCreateGoogleUser(identity)).id, owner.id, "Subsequent Google login must retain account identity");
    assert.equal(await linkGoogleUser(owner.id, identity), null, "Same subject link is idempotent");
    assert.equal(await linkGoogleUser(owner.id, { ...identity, subject: `other-${randomUUID()}` }), "already_linked");
    assert.equal(await linkGoogleUser(peer.id, { ...identity, email: peer.email }), "identity_in_use");

    const raceOwner = await createUser("race");
    const subjects = [`race-a-${randomUUID()}`, `race-b-${randomUUID()}`];
    const results = await Promise.all(subjects.map(subject => linkGoogleUser(raceOwner.id, { ...identity, email: raceOwner.email, subject })));
    assert.deepEqual(results.sort(), ["already_linked", null].sort());
    const persisted = await prisma.user.findUniqueOrThrow({ where: { id: raceOwner.id } });
    assert(subjects.includes(persisted.googleSubject));
    const claimants = [await createUser("claimant one"), await createUser("claimant two")];
    const contestedSubject = `contested-${randomUUID()}`;
    const claims = await Promise.all(claimants.map(user => linkGoogleUser(user.id, {
      ...identity, email: user.email, subject: contestedSubject,
    })));
    assert.deepEqual(claims.sort(), ["identity_in_use", null].sort());
    assert.equal(await prisma.user.count({ where: { googleSubject: contestedSubject } }), 1);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).passwordHash, owner.passwordHash);
    console.log("PASS: no email auto-link, email mismatch, missing user, full synthetic callback, linked status, repeat Google login, idempotence, no replacement, unique ownership, concurrent same-user links and concurrent identity claims");
  }
} finally {
  OAuth2Client.prototype.getToken = originalGetToken;
  OAuth2Client.prototype.verifyIdToken = originalVerifyIdToken;
  try {
    if (createdIds.length) await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await prisma.$disconnect();
  }
}
