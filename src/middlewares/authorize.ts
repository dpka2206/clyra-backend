import type { NextFunction, Request, Response } from "express";

import type { UserRole } from "../constants/roles.js";

export function authorize(roles: UserRole[]) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!request.authUser) {
      return response.status(401).json({ message: "Authentication required" });
    }

    if (!roles.includes(request.authUser.role)) {
      return response.status(403).json({ message: "Access denied" });
    }

    return next();
  };
}
