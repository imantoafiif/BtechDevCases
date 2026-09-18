import bcrypt from 'bcryptjs';

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}

export function createBcryptHasher(cost: number): PasswordHasher {
  return {
    hash: (password) => bcrypt.hash(password, cost),
    compare: (password, hash) => bcrypt.compare(password, hash),
  };
}
