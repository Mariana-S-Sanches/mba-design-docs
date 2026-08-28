import type { Order, OrderItem, OrderStatus, OrderStatusHistory, Prisma, PrismaClient } from '@prisma/client';

export type OrderListFilters = {
  status?: OrderStatus;
  customerId?: string;
  from?: Date;
  to?: Date;
  skip: number;
  take: number;
};

export type OrderWithRelations = Order & {
  items: (OrderItem & { product: { id: string; sku: string; name: string } })[];
  history: OrderStatusHistory[];
  customer: { id: string; name: string; email: string };
};

export class OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private buildWhere(filters: Omit<OrderListFilters, 'skip' | 'take'>): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = filters.from;
      if (filters.to) where.createdAt.lte = filters.to;
    }
    return where;
  }

  async list(filters: OrderListFilters): Promise<{ items: Order[]; total: number }> {
    const where = this.buildWhere(filters);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: filters.skip,
        take: filters.take,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total };
  }

  findByIdWithRelations(id: string): Promise<OrderWithRelations | null> {
    return this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { id: true, sku: true, name: true } },
          },
        },
        history: { orderBy: { changedAt: 'asc' } },
        customer: { select: { id: true, name: true, email: true } },
      },
    });
  }

  findById(id: string): Promise<Order | null> {
    return this.prisma.order.findUnique({ where: { id } });
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.order.delete({ where: { id } });
  }
}
