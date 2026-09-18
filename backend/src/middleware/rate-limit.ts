import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import type { RateLimitRule } from "../config/env";
import { AppError } from "../errors/app-error";

const tooManyRequests = () =>
  new AppError(
    429,
    "RATE_LIMITED",
    "Too many attempts, please try again later",
  );

export function loginRateLimit({ windowMs, limit }: RateLimitRule) {
  return rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => {
      const email =
        typeof req.body?.email === "string"
          ? req.body.email.trim().toLowerCase()
          : "";
      return `${ipKeyGenerator(req.ip ?? "")}:${email}`;
    },
    handler: (_req, _res, next) => next(tooManyRequests()),
  });
}

export function registerRateLimit({ windowMs, limit }: RateLimitRule) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) => next(tooManyRequests()),
  });
}
