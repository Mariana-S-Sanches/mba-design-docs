import type { RequestHandler } from 'express';
import type { ProductService } from './product.service.js';
import type { ListProductsQuery } from './product.schemas.js';

export class ProductController {
  constructor(private readonly products: ProductService) {}

  list: RequestHandler = async (req, res, next) => {
    try {
      const query = req.query as unknown as ListProductsQuery;
      const result = await this.products.list(query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getById: RequestHandler = async (req, res, next) => {
    try {
      const product = await this.products.getById(req.params.id!);
      res.status(200).json(product);
    } catch (err) {
      next(err);
    }
  };

  create: RequestHandler = async (req, res, next) => {
    try {
      const created = await this.products.create(req.body);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  };

  update: RequestHandler = async (req, res, next) => {
    try {
      const updated = await this.products.update(req.params.id!, req.body);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  };

  delete: RequestHandler = async (req, res, next) => {
    try {
      await this.products.delete(req.params.id!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
