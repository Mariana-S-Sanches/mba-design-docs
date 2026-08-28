import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  createProductSchema,
  listProductsQuerySchema,
  productIdParamSchema,
  updateProductSchema,
} from './product.schemas.js';
import type { ProductController } from './product.controller.js';

export function buildProductRouter(controller: ProductController): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/', validate({ query: listProductsQuerySchema }), controller.list);
  router.get('/:id', validate({ params: productIdParamSchema }), controller.getById);
  router.post('/', validate({ body: createProductSchema }), controller.create);
  router.patch(
    '/:id',
    validate({ params: productIdParamSchema, body: updateProductSchema }),
    controller.update,
  );
  router.delete('/:id', validate({ params: productIdParamSchema }), controller.delete);

  return router;
}
