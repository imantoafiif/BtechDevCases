import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { Db } from '../../db/connection';
import { DuplicateEmailError, type UserRecord, type UserRepository } from './user.repository';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

const toRecord = (row: UserRow): UserRecord => ({
  id: row.id,
  email: row.email,
  passwordHash: row.password_hash,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class SqliteUserRepository implements UserRepository {
  private readonly byEmail;
  private readonly byId;
  private readonly insert;

  constructor(db: Db) {
    this.byEmail = db.prepare<[string], UserRow>('SELECT * FROM users WHERE email = ?');
    this.byId = db.prepare<[string], UserRow>('SELECT * FROM users WHERE id = ?');
    this.insert = db.prepare<[string, string, string], UserRow>(
      'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?) RETURNING *',
    );
  }

  async findByEmail(email: string) {
    const row = this.byEmail.get(email);
    return row && toRecord(row);
  }

  async findById(id: string) {
    const row = this.byId.get(id);
    return row && toRecord(row);
  }

  async create({ email, passwordHash }: { email: string; passwordHash: string }) {
    try {
      return toRecord(this.insert.get(randomUUID(), email, passwordHash)!);
    } catch (error) {
      if (error instanceof Database.SqliteError && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new DuplicateEmailError();
      }
      throw error;
    }
  }
}
