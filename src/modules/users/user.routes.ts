import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import type { UserController } from './user.controller.js';

const idParamSchema = z.object({ id: z.string().uuid() });

export function buildUserRouter(controller: UserController): Router {
  const router = Router();

  router.get(
    '/:id',
    authenticate,
    requireRole('ADMIN'),
    validate({ params: idParamSchema }),
    controller.getById,
  );

  return router;
}
