import { z } from "zod";

import { USER_ROLES } from "../../constants/roles.js";

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email().optional(),
    phone: z.string().min(8),
    password: z.string().min(8),
    role: z.enum(USER_ROLES),
    profile: z
      .object({
        name: z.string().min(2),
        specialization: z.string().optional(),
        department: z.string().optional(),
      })
      .optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email().optional(),
    phone: z.string().min(8).optional(),
    password: z.string().min(8),
  }),
});

export const refreshSchema = z.object({
  body: z.object({}).optional(),
});
