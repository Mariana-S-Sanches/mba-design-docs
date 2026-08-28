import type { RequestHandler } from 'express';
import type { AuthService } from './auth.service.js';
import type { UserService } from '../users/user.service.js';
import { UnauthorizedError } from '../../shared/errors/index.js';

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  register: RequestHandler = async (req, res, next) => {
    try {
      const user = await this.authService.register(req.body);
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  };

  login: RequestHandler = async (req, res, next) => {
    try {
      const result = await this.authService.login(req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  me: RequestHandler = async (req, res, next) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const user = await this.userService.getById(req.user.id);
      res.status(200).json(user);
    } catch (err) {
      next(err);
    }
  };
}
