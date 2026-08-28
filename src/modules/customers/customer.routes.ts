import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  createCustomerSchema,
  customerIdParamSchema,
  listCustomersQuerySchema,
  updateCustomerSchema,
} from './customer.schemas.js';
import type { CustomerController } from './customer.controller.js';

export function buildCustomerRouter(controller: CustomerController): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/', validate({ query: listCustomersQuerySchema }), controller.list);
  router.get('/:id', validate({ params: customerIdParamSchema }), controller.getById);
  router.post('/', validate({ body: createCustomerSchema }), controller.create);
  router.patch(
    '/:id',
    validate({ params: customerIdParamSchema, body: updateCustomerSchema }),
    controller.update,
  );
  router.delete('/:id', validate({ params: customerIdParamSchema }), controller.delete);

  return router;
}
