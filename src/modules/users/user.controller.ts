import type { RequestHandler } from 'express';
import type { UserService } from './user.service.js';

export class UserController {
  constructor(private readonly users: UserService) {}

  getById: RequestHandler = async (req, res, next) => {
    try {
      const user = await this.users.getById(req.params.id!);
      res.status(200).json(user);
    } catch (err) {
      next(err);
    }
  };
}
