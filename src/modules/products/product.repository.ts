import type { Prisma, PrismaClient, Product } from '@prisma/client';

export type ProductListFilters = {
  search?: string;
  active?: boolean;
  skip: number;
  take: number;
};

export class ProductRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private buildWhere(filters: { search?: string; active?: boolean }): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {};
    if (filters.active !== undefined) where.active = filters.active;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { sku: { contains: filters.search } },
      ];
    }
    return where;
  }

  async list(filters: ProductListFilters): Promise<{ items: Product[]; total: number }> {
    const where = this.buildWhere(filters);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: filters.skip,
        take: filters.take,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total };
  }

  findById(id: string): Promise<Product | null> {
    return this.prisma.product.findUnique({ where: { id } });
  }

  findBySku(sku: string): Promise<Product | null> {
    return this.prisma.product.findUnique({ where: { sku } });
  }

  findManyByIds(ids: string[]): Promise<Product[]> {
    return this.prisma.product.findMany({ where: { id: { in: ids } } });
  }

  create(data: Prisma.ProductUncheckedCreateInput): Promise<Product> {
    return this.prisma.product.create({ data });
  }

  update(id: string, data: Prisma.ProductUncheckedUpdateInput): Promise<Product> {
    return this.prisma.product.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.product.delete({ where: { id } });
  }
}
