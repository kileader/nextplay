const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Prefer Spring-style JSON `{ message: "..." }`; avoid dumping raw JSON in UI. */
function parseApiErrorMessage(body: string, status: number, statusText: string): string {
  try {
    const j = JSON.parse(body) as { message?: unknown };
    if (typeof j.message === 'string' && j.message.trim().length > 0) {
      return j.message.trim();
    }
  } catch {
    /* not JSON */
  }
  const trimmed = body.trim();
  if (trimmed.length > 0 && trimmed.length <= 300) {
    return trimmed;
  }
  return `${status} ${statusText}`.trim();
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, signal } = options;

  const headers: Record<string, string> = {};
  const isFormData = body instanceof FormData;

  if (body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? (isFormData ? body : JSON.stringify(body)) : undefined,
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    const message = parseApiErrorMessage(text, response.status, response.statusText);
    throw new ApiError(response.status, message);
  }

  // 204 No Content — all other success responses are assumed to have a JSON body
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, options?: { token?: string; signal?: AbortSignal }) =>
    request<T>(path, { token: options?.token, signal: options?.signal }),
  post: <T>(path: string, body: unknown, token?: string) => request<T>(path, { method: 'POST', body, token }),
  postForm: <T>(path: string, body: FormData, token?: string) => request<T>(path, { method: 'POST', body, token }),
  put: <T>(path: string, body: unknown, token?: string) => request<T>(path, { method: 'PUT', body, token }),
  patch: <T>(path: string, body: unknown, token?: string) => request<T>(path, { method: 'PATCH', body, token }),
  delete: <T>(path: string, token?: string) => request<T>(path, { method: 'DELETE', token }),
};
