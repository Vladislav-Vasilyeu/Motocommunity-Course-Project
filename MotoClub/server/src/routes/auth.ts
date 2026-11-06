import { Router } from "express";
import { prisma } from "../db/client.js";
import { createSessionToken, hashPassword, sessionCookieOptions, verifyPassword } from "../lib/auth.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

authRouter.post("/api/auth/register", async (request, response, next) => {
  try {
    const email = normalizeEmail(request.body?.email);
    const password = typeof request.body?.password === "string" ? request.body.password : "";
    const displayName = typeof request.body?.displayName === "string" ? request.body.displayName.trim() : "";
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      response.status(400).json({ error: { code: "INVALID_EMAIL", message: "Укажите корректный адрес электронной почты" } });
      return;
    }
    if (password.length < 10 || password.length > 128) {
      response.status(400).json({ error: { code: "INVALID_PASSWORD", message: "Пароль должен содержать от 10 до 128 символов" } });
      return;
    }
    if (displayName.length < 2 || displayName.length > 60) {
      response.status(400).json({ error: { code: "INVALID_NAME", message: "Имя должно содержать от 2 до 60 символов" } });
      return;
    }
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      response.status(409).json({ error: { code: "EMAIL_IN_USE", message: "Этот адрес уже зарегистрирован" } });
      return;
    }
    const user = await prisma.user.create({
      data: {
        email,
        displayName,
        passwordHash: await hashPassword(password),
        profile: { create: {} },
      },
      select: { id: true, email: true, displayName: true, role: true },
    });
    response.cookie("motoclub_session", createSessionToken(user.id, user.role), sessionCookieOptions());
    response.status(201).json({ user });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/api/auth/login", async (request, response, next) => {
  try {
    const email = normalizeEmail(request.body?.email);
    const password = typeof request.body?.password === "string" ? request.body.password : "";
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      response.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Неверный email или пароль" } });
      return;
    }
    response.cookie("motoclub_session", createSessionToken(user.id, user.role), sessionCookieOptions());
    response.json({ user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role } });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/api/auth/logout", (_request, response) => {
  const options = sessionCookieOptions();
  response.clearCookie("motoclub_session", { httpOnly: options.httpOnly, secure: options.secure, sameSite: options.sameSite, path: options.path });
  response.status(204).end();
});

authRouter.get("/api/auth/me", requireAuth, async (request, response, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { id: true, email: true, displayName: true, role: true, profile: true },
    });
    if (!user) {
      response.status(401).json({ error: { code: "UNAUTHORIZED", message: "Войдите в аккаунт" } });
      return;
    }
    response.json({ user });
  } catch (error) {
    next(error);
  }
});
