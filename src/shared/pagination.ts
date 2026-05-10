import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function buildMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

export function skipForPage(page: number, limit: number) {
  return (page - 1) * limit;
}
