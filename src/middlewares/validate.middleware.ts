import type { RequestHandler } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { ValidationError } from '../shared/errors/index.js';

type Sources = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

export function validate<S extends Sources>(schemas: S): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body) as z.infer<NonNullable<S['body']>>;
      }
      if (schemas.query) {
        const parsedQuery = schemas.query.parse(req.query) as z.infer<NonNullable<S['query']>>;
        Object.assign(req.query, parsedQuery);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as z.infer<NonNullable<S['params']>>;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.issues.map((issue) => ({
          path: issue.path.join('.') || '(root)',
          message: issue.message,
        }));
        next(new ValidationError('Validation failed', details));
        return;
      }
      next(err);
    }
  };
}
