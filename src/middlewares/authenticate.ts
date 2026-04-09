import type { NextFunction, Request, Response } from "express";

import { verifyAccessToken } from "../utils/jwt.js";

export function authenticate(request: Request, response: Response, next: NextFunction) {
  const header = request.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return response.status(401).json({ message: "Missing or invalid authorization header" });
  }

  const token = header.replace("Bearer ", "");

  try {
    request.authUser = verifyAccessToken(token);
    return next();
  } catch {
    return response.status(401).json({ message: "Invalid or expired access token" });
  }
}
