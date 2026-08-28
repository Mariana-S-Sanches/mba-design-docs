import { afterAll, beforeAll, beforeEach } from 'vitest';
import { prisma } from '../src/config/database.js';

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.orderNumberSequence.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
