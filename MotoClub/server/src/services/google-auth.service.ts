import { OAuth2Client } from "google-auth-library";
import { prisma } from "../db/client.js";
import { Prisma } from "../generated/prisma/client.js";

export const googleCallbackPath = "/api/auth/google/callback";
const userSelect = { id: true, role: true } as const;
type GoogleIdentity = NonNullable<Awaited<ReturnType<typeof verifyGoogleIdentity>>>;

export async function googleIsLinked(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { googleSubject: true } });
  return Boolean(user?.googleSubject);
}

export type GoogleLinkError = "session_changed" | "email_mismatch" | "already_linked" | "identity_in_use";

export async function linkGoogleUser(userId: string, identity: GoogleIdentity): Promise<GoogleLinkError | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId }, select: { email: true, googleSubject: true },
  });
  if (!user) return "session_changed";
  if (user.email.trim().toLowerCase() !== identity.email) return "email_mismatch";
  if (user.googleSubject) return user.googleSubject === identity.subject ? null : "already_linked";

  try {
    // The predicate prevents overwriting a concurrent link or a changed email.
    // The unique googleSubject constraint also arbitrates concurrent owners.
    const result = await prisma.user.updateMany({
      where: { id: userId, email: user.email, googleSubject: null },
      data: { googleSubject: identity.subject },
    });
    if (result.count === 1) return null;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    return "identity_in_use";
  }

  const current = await prisma.user.findUnique({
    where: { id: userId }, select: { email: true, googleSubject: true },
  });
  if (!current) return "session_changed";
  if (current.email.trim().toLowerCase() !== identity.email) return "email_mismatch";
  return current.googleSubject === identity.subject ? null : "already_linked";
}

export function googleAuthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID?.trim() || !GOOGLE_CLIENT_SECRET?.trim() || !GOOGLE_REDIRECT_URI) return null;

  const redirect = URL.parse(GOOGLE_REDIRECT_URI);
  if (!redirect || redirect.pathname !== googleCallbackPath || redirect.search || redirect.hash ||
      redirect.username || redirect.password || !isWebUrl(redirect)) return null;

  return {
    client: new OAuth2Client(GOOGLE_CLIENT_ID.trim(), GOOGLE_CLIENT_SECRET.trim(), redirect.href),
    audience: GOOGLE_CLIENT_ID.trim(),
    secure: redirect.protocol === "https:",
  };
}

export function isWebUrl(url: URL) {
  return url.protocol === "https:" ||
    (process.env.NODE_ENV !== "production" && url.protocol === "http:");
}

export async function verifyGoogleIdentity(
  google: NonNullable<ReturnType<typeof googleAuthClient>>,
  code: string,
  codeVerifier: string,
  nonce: string,
) {
  const { tokens } = await google.client.getToken({ code, codeVerifier });
  if (!tokens.id_token) return null;

  const ticket = await google.client.verifyIdToken({ idToken: tokens.id_token, audience: google.audience });
  const claims = ticket.getPayload();
  if (!claims || !("nonce" in claims) || claims.nonce !== nonce ||
      typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 255 ||
      claims.email_verified !== true || typeof claims.email !== "string") return null;

  const email = claims.email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return null;
  const name = typeof claims.name === "string" ? claims.name.trim().slice(0, 60) : "";
  const emailName = email.split("@")[0].slice(0, 60);
  const displayName = name.length >= 2 ? name : emailName.length >= 2 ? emailName : "Райдер";
  return { subject: claims.sub, email, displayName };
}

export async function findOrCreateGoogleUser(identity: GoogleIdentity) {
  const where = { googleSubject: identity.subject };
  const existing = await prisma.user.findUnique({ where, select: userSelect });
  if (existing) return existing;

  try {
    return await prisma.user.create({
      data: {
        ...where,
        email: identity.email,
        displayName: identity.displayName,
        profile: { create: {} },
      },
      select: userSelect,
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    // A concurrent callback for the same Google identity may have created the account.
    return prisma.user.findUnique({ where, select: userSelect });
  }
}
