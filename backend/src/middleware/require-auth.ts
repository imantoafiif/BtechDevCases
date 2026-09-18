import type { RequestHandler, Response } from "express";
import { unauthorized } from "../errors/app-error";
import type { TokenClaims, TokenService } from "../modules/auth/token.service";

declare global {
  namespace Express {
    interface Locals {
      auth?: TokenClaims;
    }
  }
}

export function requireAuth(tokens: TokenService): RequestHandler {
  return async (req, res, next) => {
    const match = /^Bearer (\S+)$/.exec(req.get("Authorization") ?? "");
    if (!match?.[1])
      throw unauthorized("Missing or malformed Authorization header");
    res.locals.auth = await tokens.verify(match[1]);
    next();
  };
}

export function getAuth(res: Response): TokenClaims {
  if (!res.locals.auth) throw unauthorized();
  return res.locals.auth;
}
