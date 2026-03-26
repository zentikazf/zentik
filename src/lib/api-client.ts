import type { ApiSuccessResponse, ApiPaginatedResponse, ApiErrorResponse } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  cache?: RequestCache;
  tags?: string[];
};

class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, cache, tags } = options;

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    credentials: 'include',
    cache,
    next: tags ? { tags } : undefined,
  } as RequestInit;

  if (body) {
    config.body = JSON.stringify(body);
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}/api/v1${endpoint}`;
  const response = await fetch(url, config);

  if (!response.ok) {
    const error = (await response.json()) as ApiErrorResponse;
    throw new ApiError(
      response.status,
      error.error.code,
      error.error.message,
      error.error.details as Record<string, unknown> | undefined,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  get: <T = any>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<ApiSuccessResponse<T>>(endpoint, { ...options, method: 'GET' }),

  getPaginated: <T = any>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<ApiPaginatedResponse<T>>(endpoint, { ...options, method: 'GET' }),

  post: <T = any>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<ApiSuccessResponse<T>>(endpoint, { ...options, method: 'POST', body }),

  patch: <T = any>(
    endpoint: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ) => request<ApiSuccessResponse<T>>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T = any>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<ApiSuccessResponse<T>>(endpoint, { ...options, method: 'DELETE' }),

  upload: async <T = any>(endpoint: string, formData: FormData): Promise<ApiSuccessResponse<T>> => {
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}/api/v1${endpoint}`;
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      body: formData,
      // DO NOT set Content-Type — browser sets it automatically with boundary
    });
    if (!res.ok) {
      const error = (await res.json().catch(() => ({}))) as Record<string, any>;
      throw new ApiError(
        res.status,
        error?.error?.code || 'UPLOAD_ERROR',
        error?.error?.message || 'Upload failed',
      );
    }
    return res.json();
  },
};

export { ApiError };
