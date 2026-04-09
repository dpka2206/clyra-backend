import type { UserRole } from "../constants/roles.js";

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        userId: string;
        role: UserRole;
        sessionId?: string;
      };
    }
  }
}

export {};
