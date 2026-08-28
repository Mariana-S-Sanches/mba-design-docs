export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: Pagination;
};

export function buildPagination(page: number, pageSize: number, total: number): Pagination {
  return {
    page,
    pageSize,
    total,
    totalPages: pageSize === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

export function paginated<T>(data: T[], page: number, pageSize: number, total: number): PaginatedResponse<T> {
  return { data, pagination: buildPagination(page, pageSize, total) };
}
