import type { PaginationMeta } from 'shared/src/types/api.js';

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export function parsePagination(query: Record<string, unknown>): PaginationParams {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
  return { page, pageSize };
}

export function buildMeta(page: number, pageSize: number, total: number): PaginationMeta {
  return { page, pageSize, total };
}
