import type { Customer } from '@prisma/client';
import type { CustomerRepository } from './customer.repository.js';
import { ConflictError, NotFoundError } from '../../shared/errors/index.js';
import type {
  CreateCustomerInput,
  ListCustomersQuery,
  UpdateCustomerInput,
} from './customer.schemas.js';
import { paginated, type PaginatedResponse } from '../../shared/http/response.js';

export class CustomerService {
  constructor(private readonly customers: CustomerRepository) {}

  async list(query: ListCustomersQuery): Promise<PaginatedResponse<Customer>> {
    const { items, total } = await this.customers.list({
      search: query.search,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return paginated(items, query.page, query.pageSize, total);
  }

  async getById(id: string): Promise<Customer> {
    const customer = await this.customers.findById(id);
    if (!customer) throw new NotFoundError('Customer');
    return customer;
  }

  async create(input: CreateCustomerInput): Promise<Customer> {
    const existing = await this.customers.findByEmail(input.email);
    if (existing) {
      throw new ConflictError('Email already registered', 'EMAIL_ALREADY_USED');
    }
    return this.customers.create({
      name: input.name,
      email: input.email,
      phone: input.phone,
      document: input.document,
      address: input.address,
    });
  }

  async update(id: string, input: UpdateCustomerInput): Promise<Customer> {
    await this.getById(id);
    if (input.email) {
      const sameEmail = await this.customers.findByEmail(input.email);
      if (sameEmail && sameEmail.id !== id) {
        throw new ConflictError('Email already registered', 'EMAIL_ALREADY_USED');
      }
    }
    return this.customers.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.document !== undefined ? { document: input.document } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
    });
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);
    await this.customers.delete(id);
  }
}
