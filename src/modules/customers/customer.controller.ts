import type { RequestHandler } from 'express';
import type { CustomerService } from './customer.service.js';
import type { ListCustomersQuery } from './customer.schemas.js';

export class CustomerController {
  constructor(private readonly customers: CustomerService) {}

  list: RequestHandler = async (req, res, next) => {
    try {
      const query = req.query as unknown as ListCustomersQuery;
      const result = await this.customers.list(query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getById: RequestHandler = async (req, res, next) => {
    try {
      const customer = await this.customers.getById(req.params.id!);
      res.status(200).json(customer);
    } catch (err) {
      next(err);
    }
  };

  create: RequestHandler = async (req, res, next) => {
    try {
      const created = await this.customers.create(req.body);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  };

  update: RequestHandler = async (req, res, next) => {
    try {
      const updated = await this.customers.update(req.params.id!, req.body);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  };

  delete: RequestHandler = async (req, res, next) => {
    try {
      await this.customers.delete(req.params.id!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
