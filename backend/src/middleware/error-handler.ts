import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "../errors/app-error";
import type { ApiErrorBody } from "@btech/shared";

export const notFoundHandler: RequestHandler = (req) => {
  throw new AppError(
    404,
    "NOT_FOUND",
    `Route ${req.method} ${req.path} not found`,
  );
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  let appError: AppError;
  if (error instanceof AppError) {
    appError = error;
  } else if (error?.type === "entity.parse.failed") {
    appError = new AppError(
      400,
      "VALIDATION_ERROR",
      "Request body is not valid JSON",
    );
  } else if (error?.type === "entity.too.large") {
    appError = new AppError(
      413,
      "VALIDATION_ERROR",
      "Request body is too large",
    );
  } else {
    appError = new AppError(500, "INTERNAL_ERROR", "Something went wrong");
  }

  const body: ApiErrorBody = {
    error: {
      code: appError.code,
      message: appError.message,
      details: appError.details,
    },
  };
  res.status(appError.status).json(body);
};
