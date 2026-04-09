import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

export function validateRequest(schema: ZodType) {
  return async (request: Request, _response: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: request.body,
        query: request.query,
        params: request.params,
      });
      next();
    } catch (error) {
      next(error);
    }
  };
}
