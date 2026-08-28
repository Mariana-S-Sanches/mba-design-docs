import { Router } from 'express';
import type { AuthController } from '../modules/auth/auth.controller.js';
import type { UserController } from '../modules/users/user.controller.js';
import type { CustomerController } from '../modules/customers/customer.controller.js';
import type { ProductController } from '../modules/products/product.controller.js';
import type { OrderController } from '../modules/orders/order.controller.js';
import { buildAuthRouter } from '../modules/auth/auth.routes.js';
import { buildUserRouter } from '../modules/users/user.routes.js';
import { buildCustomerRouter } from '../modules/customers/customer.routes.js';
import { buildProductRouter } from '../modules/products/product.routes.js';
import { buildOrderRouter } from '../modules/orders/order.routes.js';

export type Controllers = {
  auth: AuthController;
  users: UserController;
  customers: CustomerController;
  products: ProductController;
  orders: OrderController;
};

export function buildApiRouter(controllers: Controllers): Router {
  const router = Router();

  router.use('/auth', buildAuthRouter(controllers.auth));
  router.use('/users', buildUserRouter(controllers.users));
  router.use('/customers', buildCustomerRouter(controllers.customers));
  router.use('/products', buildProductRouter(controllers.products));
  router.use('/orders', buildOrderRouter(controllers.orders));

  return router;
}
