import { errors, jwtVerify, SignJWT } from "jose";
import type { Config } from "../../config/env";
import { AppError, unauthorized } from "../../errors/app-error";

export type Clock = () => number;

export interface TokenClaims {
  sub: string;
  email: string;
  authTime: number;
  iat: number;
  exp: number;
}

export interface TokenService {
  sign(user: { id: string; email: string }, authTime?: number): Promise<string>;
  verify(token: string): Promise<TokenClaims>;
}

const ALGORITHM = "HS256";
const CLOCK_TOLERANCE_SECONDS = 5;

export function createTokenService(
  jwt: Config["jwt"],
  clock: Clock = Date.now,
): TokenService {
  const key = new TextEncoder().encode(jwt.secret);
  const nowSeconds = () => Math.floor(clock() / 1000);

  return {
    async sign(user, authTime) {
      const now = nowSeconds();
      return new SignJWT({ email: user.email, auth_time: authTime ?? now })
        .setProtectedHeader({ alg: ALGORITHM, typ: "JWT" })
        .setSubject(user.id)
        .setIssuer(jwt.issuer)
        .setAudience(jwt.audience)
        .setIssuedAt(now)
        .setExpirationTime(now + jwt.ttlSeconds)
        .sign(key);
    },

    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, key, {
          algorithms: [ALGORITHM],
          issuer: jwt.issuer,
          audience: jwt.audience,
          clockTolerance: CLOCK_TOLERANCE_SECONDS,
          currentDate: new Date(clock()),
          requiredClaims: ["sub", "iat", "exp"],
        });
        const { sub, email, auth_time: authTime, iat, exp } = payload;
        if (
          typeof sub !== "string" ||
          typeof email !== "string" ||
          typeof authTime !== "number" ||
          typeof iat !== "number" ||
          typeof exp !== "number"
        ) {
          throw unauthorized("Invalid token");
        }
        return { sub, email, authTime, iat, exp };
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (error instanceof errors.JWTExpired) {
          throw new AppError(401, "TOKEN_EXPIRED", "Token has expired");
        }
        throw unauthorized("Invalid token");
      }
    },
  };
}
