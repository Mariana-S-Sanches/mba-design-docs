import express, { type Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requestLogger } from './middlewares/request-logger.middleware.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { UserRepository } from './modules/users/user.repository.js';
import { UserService } from './modules/users/user.service.js';
import { UserController } from './modules/users/user.controller.js';
import { AuthService } from './modules/auth/auth.service.js';
import { AuthController } from './modules/auth/auth.controller.js';
import { CustomerRepository } from './modules/customers/customer.repository.js';
import { CustomerService } from './modules/customers/customer.service.js';
import { CustomerController } from './modules/customers/customer.controller.js';
import { ProductRepository } from './modules/products/product.repository.js';
import { ProductService } from './modules/products/product.service.js';
import { ProductController } from './modules/products/product.controller.js';
import { OrderRepository } from './modules/orders/order.repository.js';
import { OrderService } from './modules/orders/order.service.js';
import { OrderController } from './modules/orders/order.controller.js';
import { buildApiRouter, type Controllers } from './routes/index.js';
import { NotFoundError } from './shared/errors/index.js';

export type AppDependencies = {
  prisma: PrismaClient;
};

export function buildControllers(prisma: PrismaClient): Controllers {
  const userRepository = new UserRepository(prisma);
  const userService = new UserService(userRepository);
  const userController = new UserController(userService);

  const authService = new AuthService(userRepository, userService);
  const authController = new AuthController(authService, userService);

  const customerRepository = new CustomerRepository(prisma);
  const customerService = new CustomerService(customerRepository);
  const customerController = new CustomerController(customerService);

  const productRepository = new ProductRepository(prisma);
  const productService = new ProductService(productRepository);
  const productController = new ProductController(productService);

  const orderRepository = new OrderRepository(prisma);
  const orderService = new OrderService(orderRepository, prisma);
  const orderController = new OrderController(orderService);

  return {
    auth: authController,
    users: userController,
    customers: customerController,
    products: productController,
    orders: orderController,
  };
}

export function buildApp(deps: AppDependencies): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  const controllers = buildControllers(deps.prisma);
  app.use('/api/v1', buildApiRouter(controllers));

  app.use((req, _res, next) => {
    next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`));
  });

  app.use(errorMiddleware);

  return app;
}
