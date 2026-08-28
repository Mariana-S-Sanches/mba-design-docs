import { z } from 'zod';

export const productIdParamSchema = z.object({ id: z.string().uuid() });

export const createProductSchema = z.object({
  sku: z.string().min(2).max(64),
  name: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  priceCents: z.number().int().nonnegative(),
  stockQuantity: z.number().int().nonnegative().default(0),
  active: z.boolean().default(true),
});

export const updateProductSchema = createProductSchema.partial();

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  active: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
