import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  createOrderSchema,
  listOrdersQuerySchema,
  orderIdParamSchema,
  updateOrderStatusSchema,
} from './order.schemas.js';
import type { OrderController } from './order.controller.js';

export function buildOrderRouter(controller: OrderController): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/', validate({ query: listOrdersQuerySchema }), controller.list);
  router.get('/:id', validate({ params: orderIdParamSchema }), controller.getById);
  router.post('/', validate({ body: createOrderSchema }), controller.create);
  router.patch(
    '/:id/status',
    validate({ params: orderIdParamSchema, body: updateOrderStatusSchema }),
    controller.changeStatus,
  );
  router.delete('/:id', validate({ params: orderIdParamSchema }), controller.delete);

  return router;
}
