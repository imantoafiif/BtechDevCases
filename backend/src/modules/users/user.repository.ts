import type { PublicUser } from "@btech/shared";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | undefined>;
  findById(id: string): Promise<UserRecord | undefined>;
  create(input: { email: string; passwordHash: string }): Promise<UserRecord>;
}

export class DuplicateEmailError extends Error {
  constructor() {
    super("Email already registered");
    this.name = "DuplicateEmailError";
  }
}

export function toPublicUser(user: UserRecord): PublicUser {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}
