import type { RequestHandler } from "express";
import { cookieValue, readSessionToken } from "../lib/auth.js";

export const requireAuth: RequestHandler = (request, response, next) => {
  const token = cookieValue(request.headers.cookie, "motoclub_session");
  const session = token ? readSessionToken(token) : null;
  if (!session) {
    response.status(401).json({ error: { code: "UNAUTHORIZED", message: "Войдите в аккаунт" } });
    return;
  }
  request.userId = session.userId;
  request.userRole = session.role;
  next();
};

export function requireRole(...roles: string[]): RequestHandler {
  return (request, response, next) => {
    if (!request.userRole || !roles.includes(request.userRole)) {
      response.status(403).json({ error: { code: "FORBIDDEN", message: "Недостаточно прав" } });
      return;
    }
    next();
  };
}
