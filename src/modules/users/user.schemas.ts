import { z } from 'zod';

export const userIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const createUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
  name: z.string().min(2).max(150),
  role: z.enum(['ADMIN', 'OPERATOR']).default('OPERATOR'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
