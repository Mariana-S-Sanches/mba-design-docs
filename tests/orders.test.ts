import { describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  bootstrapAuthenticatedUser,
  createTestCustomer,
  createTestProduct,
  getTestApp,
} from './helpers/factories.js';
import { prisma } from '../src/config/database.js';

describe('Orders', () => {
  it('creates an order in PENDING status and computes totals on the server', async () => {
    const app = getTestApp();
    const { token } = await bootstrapAuthenticatedUser();
    const customer = await createTestCustomer();
    const productA = await createTestProduct({ priceCents: 5000, stockQuantity: 20 });
    const productB = await createTestProduct({ priceCents: 1500, stockQuantity: 10 });

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: customer.id,
        items: [
          { productId: productA.id, quantity: 3 },
          { productId: productB.id, quantity: 2 },
        ],
        discountCents: 1000,
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.subtotalCents).toBe(5000 * 3 + 1500 * 2);
    expect(res.body.discountCents).toBe(1000);
    expect(res.body.totalCents).toBe(5000 * 3 + 1500 * 2 - 1000);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.history).toHaveLength(1);
    expect(res.body.history[0].toStatus).toBe('PENDING');
    expect(res.body.orderNumber).toMatch(/^ORD-\d{6}$/);
  });

  it('rejects an order with non-existent product', async () => {
    const app = getTestApp();
    const { token } = await bootstrapAuthenticatedUser();
    const customer = await createTestCustomer();

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: customer.id,
        items: [{ productId: '11111111-1111-1111-1111-111111111111', quantity: 1 }],
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('transitions PENDING -> PAID and decrements stock', async () => {
    const app = getTestApp();
    const { token } = await bootstrapAuthenticatedUser();
    const customer = await createTestCustomer();
    const product = await createTestProduct({ priceCents: 2000, stockQuantity: 5 });

    const create = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId: customer.id, items: [{ productId: product.id, quantity: 3 }] });
    expect(create.status).toBe(201);

    const orderId = create.body.id as string;

    const updated = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ toStatus: 'PAID', reason: 'payment confirmed' });

    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('PAID');
    expect(updated.body.history.map((h: { toStatus: string }) => h.toStatus)).toEqual([
      'PENDING',
      'PAID',
    ]);

    const refreshed = await prisma.product.findUnique({ where: { id: product.id } });
    expect(refreshed?.stockQuantity).toBe(2);
  });

  it('returns 409 on invalid status transition (PENDING -> SHIPPED)', async () => {
    const app = getTestApp();
    const { token } = await bootstrapAuthenticatedUser();
    const customer = await createTestCustomer();
    const product = await createTestProduct({ stockQuantity: 5 });

    const create = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId: customer.id, items: [{ productId: product.id, quantity: 1 }] });

    const res = await request(app)
      .patch(`/api/v1/orders/${create.body.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ toStatus: 'SHIPPED' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('returns 422 when transitioning PENDING -> PAID without enough stock', async () => {
    const app = getTestApp();
    const { token } = await bootstrapAuthenticatedUser();
    const customer = await createTestCustomer();
    const product = await createTestProduct({ stockQuantity: 1 });

    const create = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId: customer.id, items: [{ productId: product.id, quantity: 5 }] });
    expect(create.status).toBe(201);

    const res = await request(app)
      .patch(`/api/v1/orders/${create.body.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ toStatus: 'PAID' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(res.body.error.details.unavailable[0].sku).toBe(product.sku);

    const refreshed = await prisma.product.findUnique({ where: { id: product.id } });
    expect(refreshed?.stockQuantity).toBe(1);
  });

  it('replenishes stock when going PAID -> CANCELLED', async () => {
    const app = getTestApp();
    const { token } = await bootstrapAuthenticatedUser();
    const customer = await createTestCustomer();
    const product = await createTestProduct({ stockQuantity: 10 });

    const create = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId: customer.id, items: [{ productId: product.id, quantity: 4 }] });

    await request(app)
      .patch(`/api/v1/orders/${create.body.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ toStatus: 'PAID' });

    const afterPaid = await prisma.product.findUnique({ where: { id: product.id } });
    expect(afterPaid?.stockQuantity).toBe(6);

    const cancel = await request(app)
      .patch(`/api/v1/orders/${create.body.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ toStatus: 'CANCELLED', reason: 'customer changed mind' });
    expect(cancel.status).toBe(200);

    const afterCancel = await prisma.product.findUnique({ where: { id: product.id } });
    expect(afterCancel?.stockQuantity).toBe(10);
  });

  it('lists orders filtered by status', async () => {
    const app = getTestApp();
    const { token } = await bootstrapAuthenticatedUser();
    const customer = await createTestCustomer();
    const product = await createTestProduct({ stockQuantity: 100 });

    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ customerId: customer.id, items: [{ productId: product.id, quantity: 1 }] });
      ids.push(r.body.id);
    }

    await request(app)
      .patch(`/api/v1/orders/${ids[0]}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ toStatus: 'PAID' });

    const paid = await request(app)
      .get('/api/v1/orders?status=PAID')
      .set('Authorization', `Bearer ${token}`);
    expect(paid.status).toBe(200);
    expect(paid.body.data).toHaveLength(1);
    expect(paid.body.data[0].id).toBe(ids[0]);

    const pending = await request(app)
      .get('/api/v1/orders?status=PENDING')
      .set('Authorization', `Bearer ${token}`);
    expect(pending.body.data).toHaveLength(2);
    expect(pending.body.pagination.total).toBe(2);
  });

  it('refuses to delete an order that is not PENDING or CANCELLED', async () => {
    const app = getTestApp();
    const { token } = await bootstrapAuthenticatedUser();
    const customer = await createTestCustomer();
    const product = await createTestProduct({ stockQuantity: 5 });

    const create = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId: customer.id, items: [{ productId: product.id, quantity: 1 }] });
    await request(app)
      .patch(`/api/v1/orders/${create.body.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ toStatus: 'PAID' });

    const res = await request(app)
      .delete(`/api/v1/orders/${create.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_ORDER_STATE_FOR_DELETE');
  });
});
