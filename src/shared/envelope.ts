export interface ApiMeta {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: ApiMeta;
}

export function ok<T>(message: string, data?: T, meta?: ApiMeta): ApiResponse<T> {
  return { success: true, message, data, meta };
}

export function fail(message: string, data?: unknown, meta?: ApiMeta): ApiResponse {
  return { success: false, message, data, meta };
}
