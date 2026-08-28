import { Router } from 'express';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import type { AuthController } from './auth.controller.js';

export function buildAuthRouter(controller: AuthController): Router {
  const router = Router();

  router.post('/register', validate({ body: registerSchema }), controller.register);
  router.post('/login', validate({ body: loginSchema }), controller.login);
  router.get('/me', authenticate, controller.me);

  return router;
}
