import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { CodeChallengeMethod } from "google-auth-library";
import { cookieValue, createSessionToken, sessionCookieOptions } from "../lib/auth.js";
import {
  findOrCreateGoogleUser,
  googleAuthClient,
  googleCallbackPath,
  isWebUrl,
  verifyGoogleIdentity,
} from "../services/google-auth.service.js";

export const googleAuthRouter = Router();

const flowLifetimeMs = 10 * 60 * 1000;
const randomToken = () => randomBytes(32).toString("base64url");
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

function clientOrigin() {
  const origin = URL.parse(process.env.CLIENT_ORIGIN ?? "http://localhost:5173");
  return origin && isWebUrl(origin) && !origin.username && !origin.password &&
    origin.pathname === "/" && !origin.hash && !origin.search ? origin : null;
}

function authPage(mode: unknown) {
  return mode === "register" ? "/register" : "/login";
}

function flowCookie(secure: boolean) {
  return {
    name: secure ? "__Host-motoclub_google_flow" : "motoclub_google_flow",
    options: { httpOnly: true, secure, sameSite: "lax" as const, path: "/" },
  };
}

function stateMatches(state: unknown, expected: string) {
  return typeof state === "string" && tokenPattern.test(state) && tokenPattern.test(expected) &&
    timingSafeEqual(Buffer.from(state), Buffer.from(expected));
}

googleAuthRouter.use("/api/auth/google", (_request, response, next) => {
  response.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  next();
});

googleAuthRouter.get("/api/auth/google", (_request, response) => {
  response.json({ enabled: Boolean(googleAuthClient() && clientOrigin()) });
});

googleAuthRouter.get("/api/auth/google/start", (request, response) => {
  const google = googleAuthClient();
  const origin = clientOrigin();
  if (!google || !origin) {
    response.status(503).json({ error: { code: "GOOGLE_UNAVAILABLE", message: "Вход через Google недоступен" } });
    return;
  }

  const state = randomToken();
  const nonce = randomToken();
  const codeVerifier = randomToken();
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const mode = request.query.mode === "register" ? "register" : "login";
  const cookie = flowCookie(google.secure);
  response.cookie(cookie.name, [state, nonce, codeVerifier, mode, Date.now()].join("."), {
    ...cookie.options,
    maxAge: flowLifetimeMs,
  });

  const authorizationUrl = new URL(google.client.generateAuthUrl({
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256,
  }));
  authorizationUrl.searchParams.set("nonce", nonce);
  response.redirect(authorizationUrl.href);
});

googleAuthRouter.get(googleCallbackPath, async (request, response, next) => {
  const google = googleAuthClient();
  const origin = clientOrigin();
  if (!google || !origin) {
    response.status(503).json({ error: { code: "GOOGLE_UNAVAILABLE", message: "Вход через Google недоступен" } });
    return;
  }

  const cookie = flowCookie(google.secure);
  const flow = cookieValue(request.headers.cookie, cookie.name);
  const [state = "", nonce = "", codeVerifier = "", mode, startedAt] = flow?.split(".") ?? [];
  const authUrl = new URL(authPage(mode), origin);
  function redirectWithError(code: string) {
    authUrl.searchParams.set("googleError", code);
    response.redirect(authUrl.href);
  }

  const age = Date.now() - Number(startedAt);
  if (!stateMatches(request.query.state, state) || !tokenPattern.test(nonce) || !tokenPattern.test(codeVerifier) ||
      !Number.isFinite(age) || age < 0 || age > flowLifetimeMs) {
    redirectWithError("expired");
    return;
  }
  response.clearCookie(cookie.name, cookie.options);

  if (request.query.error === "access_denied") {
    redirectWithError("cancelled");
    return;
  }
  const code = request.query.code;
  if (typeof code !== "string" || !code) {
    redirectWithError("failed");
    return;
  }

  const identity = await verifyGoogleIdentity(google, code, codeVerifier, nonce).catch(() => null);
  if (!identity) {
    redirectWithError("failed");
    return;
  }

  try {
    const user = await findOrCreateGoogleUser(identity);
    if (!user) {
      redirectWithError("email_in_use");
      return;
    }
    response.cookie("motoclub_session", createSessionToken(user.id, user.role), sessionCookieOptions());
    response.redirect(new URL("/", origin).href);
  } catch (error) {
    next(error);
  }
});
