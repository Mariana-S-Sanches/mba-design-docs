import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { UnauthorizedError } from '../../shared/errors/index.js';
import type { UserRepository } from '../users/user.repository.js';
import { UserService, type PublicUser } from '../users/user.service.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

export type AuthTokens = {
  accessToken: string;
  expiresIn: string;
  tokenType: 'Bearer';
};

export type LoginResult = {
  user: PublicUser;
  tokens: AuthTokens;
};

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly userService: UserService,
  ) {}

  async register(input: RegisterInput): Promise<PublicUser> {
    return this.userService.createUser(input);
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const user = await this.users.findByEmail(input.email);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedError('Invalid credentials');
    }
    const token = this.signToken(user.id, user.email, user.role);
    return {
      user: UserService.toPublic(user),
      tokens: { accessToken: token, expiresIn: env.JWT_EXPIRES_IN, tokenType: 'Bearer' },
    };
  }

  private signToken(userId: string, email: string, role: 'ADMIN' | 'OPERATOR'): string {
    const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
    return jwt.sign({ sub: userId, email, role }, env.JWT_SECRET, options);
  }
}
