import type { ApiSuccessResponse, ApiPaginatedResponse, ApiErrorResponse } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ── Bearer token helpers ────────────────────────────────────────────────
// El backend acepta tanto cookie como header Authorization: Bearer <token>.
// En mobile las cookies cross-domain (frontend Vercel ↔ backend Railway) se
// bloquean por third-party cookies — por eso tambien guardamos el token en
// localStorage y lo mandamos en cada request via header.

const TOKEN_KEY = 'zentikk.session_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // localStorage puede estar deshabilitado (modo incognito estricto, etc.)
  }
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

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

  const token = getToken();

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    // Sesion expirada -> volver al login
    if (response.status === 401 && typeof window !== 'undefined' && !endpoint.includes('/auth/')) {
      clearToken();
      window.location.href = '/login';
      throw new ApiError(401, 'SESSION_EXPIRED', 'Sesión expirada');
    }

    // Email no verificado -> /verify-pending (no aplica en /auth/* ni si ya estamos ahi)
    if (
      response.status === 403 &&
      typeof window !== 'undefined' &&
      !endpoint.includes('/auth/') &&
      !window.location.pathname.startsWith('/verify-pending')
    ) {
      const peek = await response.clone().json().catch(() => null);
      if (peek?.error?.code === 'EMAIL_NOT_VERIFIED') {
        window.location.href = '/verify-pending';
        throw new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Verifica tu correo antes de acceder');
      }
    }

    const error = (await response.json().catch(() => ({ error: { code: 'UNKNOWN', message: 'Error desconocido' } }))) as ApiErrorResponse;
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
    const token = getToken();
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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
