import type { Customer, Prisma, PrismaClient } from '@prisma/client';

export type CustomerListFilters = {
  search?: string;
  skip: number;
  take: number;
};

export class CustomerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private buildWhere(filters: { search?: string }): Prisma.CustomerWhereInput {
    if (!filters.search) return {};
    const term = filters.search;
    return {
      OR: [
        { name: { contains: term } },
        { email: { contains: term } },
        { document: { contains: term } },
      ],
    };
  }

  async list(filters: CustomerListFilters): Promise<{ items: Customer[]; total: number }> {
    const where = this.buildWhere(filters);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: filters.skip,
        take: filters.take,
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { items, total };
  }

  findById(id: string): Promise<Customer | null> {
    return this.prisma.customer.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<Customer | null> {
    return this.prisma.customer.findUnique({ where: { email } });
  }

  create(data: Prisma.CustomerUncheckedCreateInput): Promise<Customer> {
    return this.prisma.customer.create({ data });
  }

  update(id: string, data: Prisma.CustomerUncheckedUpdateInput): Promise<Customer> {
    return this.prisma.customer.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.customer.delete({ where: { id } });
  }
}
