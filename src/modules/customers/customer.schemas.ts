import { z } from 'zod';

export const customerIdParamSchema = z.object({
  id: z.string().uuid(),
});

const addressSchema = z.object({
  street: z.string().min(1).max(200),
  number: z.string().min(1).max(20),
  city: z.string().min(1).max(100),
  state: z.string().length(2),
  zipCode: z.string().min(5).max(15),
});

export const createCustomerSchema = z.object({
  name: z.string().min(2).max(150),
  email: z.string().email().max(255),
  phone: z.string().min(8).max(32),
  document: z.string().min(11).max(20),
  address: addressSchema,
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;
