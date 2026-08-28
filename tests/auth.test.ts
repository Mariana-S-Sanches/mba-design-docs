import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { getTestApp, createTestUser, loginAndGetToken } from './helpers/factories.js';

describe('Auth flow', () => {
  it('registers a new user and returns 201 with public data only', async () => {
    const app = getTestApp();
    const email = `register-${Date.now()}@test.local`;
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'strongPass123', name: 'Newcomer', role: 'OPERATOR' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email, name: 'Newcomer', role: 'OPERATOR' });
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('password');
  });

  it('rejects register with duplicated email', async () => {
    const app = getTestApp();
    const { user } = await createTestUser({ email: 'dup@test.local' });
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: user.email, password: 'strongPass123', name: 'Dup' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_USED');
  });

  it('rejects register with invalid payload', async () => {
    const app = getTestApp();
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'short', name: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it('logs in successfully and returns an access token', async () => {
    const app = getTestApp();
    const { user, password } = await createTestUser();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password });

    expect(res.status).toBe(200);
    expect(res.body.tokens.accessToken).toBeTypeOf('string');
    expect(res.body.tokens.tokenType).toBe('Bearer');
    expect(res.body.user.email).toBe(user.email);
  });

  it('rejects login with wrong password', async () => {
    const app = getTestApp();
    const { user } = await createTestUser();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns the authenticated user on GET /auth/me', async () => {
    const app = getTestApp();
    const { user, password } = await createTestUser();
    const token = await loginAndGetToken(user.email, password);

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.email).toBe(user.email);
  });

  it('rejects /auth/me without token', async () => {
    const app = getTestApp();
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});
