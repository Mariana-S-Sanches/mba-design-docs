import type { RequestHandler } from 'express';
import type { OrderService } from './order.service.js';
import type { ListOrdersQuery } from './order.schemas.js';
import { UnauthorizedError } from '../../shared/errors/index.js';

export class OrderController {
  constructor(private readonly orders: OrderService) {}

  list: RequestHandler = async (req, res, next) => {
    try {
      const query = req.query as unknown as ListOrdersQuery;
      const result = await this.orders.list(query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getById: RequestHandler = async (req, res, next) => {
    try {
      const order = await this.orders.getById(req.params.id!);
      res.status(200).json(order);
    } catch (err) {
      next(err);
    }
  };

  create: RequestHandler = async (req, res, next) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const created = await this.orders.create(req.body, req.user.id);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  };

  changeStatus: RequestHandler = async (req, res, next) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const updated = await this.orders.changeStatus(req.params.id!, req.body, req.user.id);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  };

  delete: RequestHandler = async (req, res, next) => {
    try {
      await this.orders.delete(req.params.id!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
