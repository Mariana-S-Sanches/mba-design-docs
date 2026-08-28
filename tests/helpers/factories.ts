import bcrypt from 'bcrypt';
import type { Customer, Product, User } from '@prisma/client';
import { prisma } from '../../src/config/database.js';
import { buildApp } from '../../src/app.js';
import request from 'supertest';
import type { Express } from 'express';

let cachedApp: Express | null = null;

export function getTestApp(): Express {
  if (!cachedApp) {
    cachedApp = buildApp({ prisma });
  }
  return cachedApp;
}

export async function createTestUser(
  overrides: Partial<{ email: string; password: string; name: string; role: 'ADMIN' | 'OPERATOR' }> = {},
): Promise<{ user: User; password: string }> {
  const password = overrides.password ?? 'password123';
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email: overrides.email ?? `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`,
      name: overrides.name ?? 'Test User',
      passwordHash,
      role: overrides.role ?? 'OPERATOR',
    },
  });
  return { user, password };
}

export async function loginAndGetToken(email: string, password: string): Promise<string> {
  const app = getTestApp();
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.tokens.accessToken as string;
}

export async function createTestCustomer(
  overrides: Partial<{ name: string; email: string; phone: string; document: string }> = {},
): Promise<Customer> {
  return prisma.customer.create({
    data: {
      name: overrides.name ?? 'Test Customer',
      email: overrides.email ?? `customer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`,
      phone: overrides.phone ?? '+5511999999999',
      document: overrides.document ?? '000.000.000-00',
      address: {
        street: 'Rua Teste',
        number: '100',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01000-000',
      },
    },
  });
}

export async function createTestProduct(
  overrides: Partial<{ sku: string; name: string; priceCents: number; stockQuantity: number; active: boolean }> = {},
): Promise<Product> {
  return prisma.product.create({
    data: {
      sku: overrides.sku ?? `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      name: overrides.name ?? 'Test Product',
      priceCents: overrides.priceCents ?? 10000,
      stockQuantity: overrides.stockQuantity ?? 10,
      active: overrides.active ?? true,
    },
  });
}

export async function bootstrapAuthenticatedUser(role: 'ADMIN' | 'OPERATOR' = 'OPERATOR'): Promise<{
  user: User;
  token: string;
}> {
  const { user, password } = await createTestUser({ role });
  const token = await loginAndGetToken(user.email, password);
  return { user, token };
}
