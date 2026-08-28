import type { Product } from '@prisma/client';
import type { ProductRepository } from './product.repository.js';
import { ConflictError, NotFoundError } from '../../shared/errors/index.js';
import type {
  CreateProductInput,
  ListProductsQuery,
  UpdateProductInput,
} from './product.schemas.js';
import { paginated, type PaginatedResponse } from '../../shared/http/response.js';

export class ProductService {
  constructor(private readonly products: ProductRepository) {}

  async list(query: ListProductsQuery): Promise<PaginatedResponse<Product>> {
    const { items, total } = await this.products.list({
      search: query.search,
      active: query.active,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return paginated(items, query.page, query.pageSize, total);
  }

  async getById(id: string): Promise<Product> {
    const product = await this.products.findById(id);
    if (!product) throw new NotFoundError('Product');
    return product;
  }

  async create(input: CreateProductInput): Promise<Product> {
    const existing = await this.products.findBySku(input.sku);
    if (existing) {
      throw new ConflictError('SKU already in use', 'SKU_ALREADY_USED');
    }
    return this.products.create({
      sku: input.sku,
      name: input.name,
      description: input.description ?? null,
      priceCents: input.priceCents,
      stockQuantity: input.stockQuantity,
      active: input.active,
    });
  }

  async update(id: string, input: UpdateProductInput): Promise<Product> {
    await this.getById(id);
    if (input.sku) {
      const sameSku = await this.products.findBySku(input.sku);
      if (sameSku && sameSku.id !== id) {
        throw new ConflictError('SKU already in use', 'SKU_ALREADY_USED');
      }
    }
    return this.products.update(id, {
      ...(input.sku !== undefined ? { sku: input.sku } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.priceCents !== undefined ? { priceCents: input.priceCents } : {}),
      ...(input.stockQuantity !== undefined ? { stockQuantity: input.stockQuantity } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    });
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);
    await this.products.delete(id);
  }
}
