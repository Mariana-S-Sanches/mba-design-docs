import bcrypt from 'bcrypt';
import type { User } from '@prisma/client';
import type { UserRepository } from './user.repository.js';
import { ConflictError, NotFoundError } from '../../shared/errors/index.js';
import type { CreateUserInput } from './user.schemas.js';

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'OPERATOR';
  createdAt: Date;
  updatedAt: Date;
};

const BCRYPT_ROUNDS = 10;

export class UserService {
  constructor(private readonly users: UserRepository) {}

  async createUser(input: CreateUserInput): Promise<PublicUser> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw new ConflictError('Email already registered', 'EMAIL_ALREADY_USED');
    }
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const created = await this.users.create({
      email: input.email,
      passwordHash,
      name: input.name,
      role: input.role,
    });
    return UserService.toPublic(created);
  }

  async getById(id: string): Promise<PublicUser> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError('User');
    return UserService.toPublic(user);
  }

  static toPublic(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
