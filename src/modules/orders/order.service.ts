import {
  type Order,
  OrderStatus,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import type { OrderRepository, OrderWithRelations } from './order.repository.js';
import type { CreateOrderInput, ListOrdersQuery, UpdateOrderStatusInput } from './order.schemas.js';
import {
  ConflictError,
  InsufficientStockError,
  InvalidStatusTransitionError,
  NotFoundError,
  UnprocessableEntityError,
  ValidationError,
} from '../../shared/errors/index.js';
import {
  canTransition,
  shouldDebitStock,
  shouldReplenishStock,
} from './order.status.js';
import { paginated, type PaginatedResponse } from '../../shared/http/response.js';

type TxClient = Prisma.TransactionClient;

export class OrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly prisma: PrismaClient,
  ) {}

  async list(query: ListOrdersQuery): Promise<PaginatedResponse<Order>> {
    const { items, total } = await this.orders.list({
      status: query.status,
      customerId: query.customerId,
      from: query.from,
      to: query.to,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return paginated(items, query.page, query.pageSize, total);
  }

  async getById(id: string): Promise<OrderWithRelations> {
    const order = await this.orders.findByIdWithRelations(id);
    if (!order) throw new NotFoundError('Order');
    return order;
  }

  async create(input: CreateOrderInput, userId: string): Promise<OrderWithRelations> {
    if (input.items.length === 0) {
      throw new ValidationError('Order must contain at least one item');
    }

    const aggregatedItems = this.aggregateItems(input.items);
    const productIds = aggregatedItems.map((i) => i.productId);

    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
      if (!customer) throw new NotFoundError('Customer');

      const products = await tx.product.findMany({ where: { id: { in: productIds } } });
      if (products.length !== productIds.length) {
        throw new NotFoundError('Product');
      }
      const inactive = products.filter((p) => !p.active);
      if (inactive.length > 0) {
        throw new UnprocessableEntityError(
          'One or more products are inactive',
          'INACTIVE_PRODUCT',
          { skus: inactive.map((p) => p.sku) },
        );
      }

      const itemsToCreate = aggregatedItems.map((it) => {
        const product = products.find((p) => p.id === it.productId)!;
        const unitPriceCents = product.priceCents;
        return {
          productId: product.id,
          quantity: it.quantity,
          unitPriceCents,
          totalCents: unitPriceCents * it.quantity,
        };
      });

      const subtotalCents = itemsToCreate.reduce((sum, it) => sum + it.totalCents, 0);
      if (input.discountCents > subtotalCents) {
        throw new ValidationError('Discount cannot exceed subtotal', [
          { path: 'discountCents', message: 'Discount exceeds subtotal' },
        ]);
      }
      const totalCents = subtotalCents - input.discountCents;
      const orderNumber = await this.reserveOrderNumber(tx);

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: input.customerId,
          status: OrderStatus.PENDING,
          subtotalCents,
          discountCents: input.discountCents,
          totalCents,
          notes: input.notes ?? null,
          createdById: userId,
          items: { create: itemsToCreate },
          history: {
            create: {
              fromStatus: null,
              toStatus: OrderStatus.PENDING,
              changedById: userId,
              reason: 'order created',
            },
          },
        },
        include: {
          items: { include: { product: { select: { id: true, sku: true, name: true } } } },
          history: { orderBy: { changedAt: 'asc' } },
          customer: { select: { id: true, name: true, email: true } },
        },
      });

      return order;
    });
  }

  async changeStatus(
    id: string,
    input: UpdateOrderStatusInput,
    userId: string,
  ): Promise<OrderWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!order) throw new NotFoundError('Order');

      const from = order.status;
      const to = input.toStatus;
      if (from === to) {
        throw new ConflictError(
          `Order is already in ${to} status`,
          'INVALID_STATUS_TRANSITION',
          { from, to },
        );
      }
      if (!canTransition(from, to)) {
        throw new InvalidStatusTransitionError(from, to);
      }

      if (shouldDebitStock(from, to)) {
        await this.debitStock(tx, order.items);
      }
      if (shouldReplenishStock(from, to)) {
        await this.replenishStock(tx, order.items);
      }

      await tx.order.update({ where: { id }, data: { status: to } });
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: from,
          toStatus: to,
          changedById: userId,
          reason: input.reason ?? null,
        },
      });

      const refreshed = await tx.order.findUnique({
        where: { id },
        include: {
          items: { include: { product: { select: { id: true, sku: true, name: true } } } },
          history: { orderBy: { changedAt: 'asc' } },
          customer: { select: { id: true, name: true, email: true } },
        },
      });
      return refreshed!;
    });
  }

  async delete(id: string): Promise<void> {
    const order = await this.orders.findById(id);
    if (!order) throw new NotFoundError('Order');
    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CANCELLED) {
      throw new ConflictError(
        'Order can only be deleted while in PENDING or CANCELLED status',
        'INVALID_ORDER_STATE_FOR_DELETE',
        { status: order.status },
      );
    }
    await this.orders.deleteById(id);
  }

  private aggregateItems(
    items: CreateOrderInput['items'],
  ): { productId: string; quantity: number }[] {
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
    }
    return Array.from(map.entries()).map(([productId, quantity]) => ({ productId, quantity }));
  }

  private async debitStock(
    tx: TxClient,
    items: { productId: string; quantity: number }[],
  ): Promise<void> {
    const products = await tx.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
    });
    const unavailable: { sku: string; requested: number; available: number }[] = [];
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product || product.stockQuantity < item.quantity) {
        unavailable.push({
          sku: product?.sku ?? item.productId,
          requested: item.quantity,
          available: product?.stockQuantity ?? 0,
        });
      }
    }
    if (unavailable.length > 0) {
      throw new InsufficientStockError(unavailable);
    }
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQuantity: { decrement: item.quantity } },
      });
    }
  }

  private async replenishStock(
    tx: TxClient,
    items: { productId: string; quantity: number }[],
  ): Promise<void> {
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQuantity: { increment: item.quantity } },
      });
    }
  }

  private async reserveOrderNumber(tx: TxClient): Promise<string> {
    const seq = await tx.orderNumberSequence.upsert({
      where: { id: 1 },
      create: { id: 1, nextValue: 2 },
      update: { nextValue: { increment: 1 } },
      select: { nextValue: true },
    });
    const current = seq.nextValue - 1;
    return `ORD-${String(current).padStart(6, '0')}`;
  }
}
