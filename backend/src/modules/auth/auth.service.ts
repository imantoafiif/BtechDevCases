import type {
  AuthResponse,
  LoginInput,
  MeResponse,
  RegisterInput,
  RegisterResponse,
} from "@btech/shared";
import type { Config } from "../../config/env";
import { AppError, unauthorized } from "../../errors/app-error";
import {
  DuplicateEmailError,
  toPublicUser,
  type UserRecord,
  type UserRepository,
} from "../users/user.repository";
import type { PasswordHasher } from "./password.service";
import type { Clock, TokenClaims, TokenService } from "./token.service";

interface AuthServiceDeps {
  users: UserRepository;
  hasher: PasswordHasher;
  tokens: TokenService;
  jwt: Config["jwt"];
  clock?: Clock;
}

export type AuthService = ReturnType<typeof createAuthService>;

export function createAuthService({
  users,
  hasher,
  tokens,
  jwt,
  clock = Date.now,
}: AuthServiceDeps) {
  // Compared against when the email is unknown, so login takes the same time either way.
  let dummyHash: Promise<string> | undefined;
  const getDummyHash = () =>
    (dummyHash ??= hasher.hash("timing-equalization-placeholder"));

  async function issueToken(
    user: UserRecord,
    authTime?: number,
  ): Promise<AuthResponse> {
    return {
      accessToken: await tokens.sign(user, authTime),
      tokenType: "Bearer",
      expiresIn: jwt.ttlSeconds,
      user: toPublicUser(user),
    };
  }

  async function findUserForToken(claims: TokenClaims) {
    const user = await users.findById(claims.sub);
    if (!user) throw unauthorized("User no longer exists");
    return user;
  }

  return {
    async register(input: RegisterInput): Promise<RegisterResponse> {
      const passwordHash = await hasher.hash(input.password);
      try {
        const user = await users.create({ email: input.email, passwordHash });
        return { user: toPublicUser(user) };
      } catch (error) {
        if (error instanceof DuplicateEmailError) {
          throw new AppError(
            409,
            "EMAIL_TAKEN",
            "An account with this email already exists",
          );
        }
        throw error;
      }
    },

    async login(input: LoginInput): Promise<AuthResponse> {
      const user = await users.findByEmail(input.email);
      const passwordMatches = await hasher.compare(
        input.password,
        user?.passwordHash ?? (await getDummyHash()),
      );
      if (!user || !passwordMatches) {
        throw new AppError(
          401,
          "INVALID_CREDENTIALS",
          "Invalid email or password",
        );
      }
      return issueToken(user);
    },

    async renew(claims: TokenClaims): Promise<AuthResponse> {
      const nowSeconds = Math.floor(clock() / 1000);
      if (nowSeconds - claims.authTime > jwt.sessionMaxAgeSeconds) {
        throw new AppError(
          401,
          "SESSION_EXPIRED",
          "Session has expired, please log in again",
        );
      }
      return issueToken(await findUserForToken(claims), claims.authTime);
    },

    async me(claims: TokenClaims): Promise<MeResponse> {
      const user = await findUserForToken(claims);
      return {
        message: `Hello ${user.email}, welcome back`,
        user: toPublicUser(user),
      };
    },
  };
}
