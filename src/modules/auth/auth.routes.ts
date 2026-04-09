import type { Response } from "express";
import { Router } from "express";

import { env } from "../../config/env.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { validateRequest } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  getCurrentUser,
  loginUser,
  logoutUserByRefreshToken,
  refreshUserSession,
  registerUser,
} from "./auth.service.js";
import { loginSchema, refreshSchema, registerSchema } from "./auth.schema.js";

const REFRESH_COOKIE = "medicnct_refresh_token";

function setRefreshCookie(response: Response, refreshToken: string) {
  response.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE || env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export const authRouter = Router();

authRouter.post(
  "/register",
  validateRequest(registerSchema),
  asyncHandler(async (request, response) => {
    const user = await registerUser(request.body);
    response.status(201).json({
      message: "User registered successfully",
      userId: user._id,
      role: user.role,
    });
  }),
);

authRouter.post(
  "/login",
  validateRequest(loginSchema),
  asyncHandler(async (request, response) => {
    const session = await loginUser(request.body);
    setRefreshCookie(response, session.refreshToken);

    response.json({
      message: "Login successful",
      accessToken: session.accessToken,
      sessionId: session.sessionId,
    });
  }),
);

authRouter.post(
  "/refresh",
  validateRequest(refreshSchema),
  asyncHandler(async (request, response) => {
    const refreshToken = request.cookies[REFRESH_COOKIE] as string | undefined;

    if (!refreshToken) {
      return response.status(401).json({ message: "Refresh token missing" });
    }

    const session = await refreshUserSession(refreshToken);
    setRefreshCookie(response, session.refreshToken);

    return response.json({
      message: "Session refreshed",
      accessToken: session.accessToken,
      sessionId: session.sessionId,
    });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (request, response) => {
    const refreshToken = request.cookies[REFRESH_COOKIE] as string | undefined;
    await logoutUserByRefreshToken(refreshToken);

    response.clearCookie(REFRESH_COOKIE);
    response.json({ message: "Logged out" });
  }),
);

authRouter.get(
  "/me",
  authenticate,
  asyncHandler(async (request, response) => {
    const user = await getCurrentUser(request.authUser!.userId);
    response.json({ user });
  }),
);
