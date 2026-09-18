import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../errors/app-error";

export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const { fieldErrors } = z.flattenError(result.error);
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Invalid request body",
        fieldErrors as Record<string, string[]>,
      );
    }
    req.body = result.data;
    next();
  };
}
