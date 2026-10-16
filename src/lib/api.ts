const API_BASE = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('aavni_token');
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('aavni_token', token);
  } else {
    localStorage.removeItem('aavni_token');
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (res.status === 401) {
    // If unauthorized, clear token
    if (window.location.pathname !== '/login') {
      // dispatch logout event
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }

  return data as T;
}

export const api = {
  get: <T = any>(url: string) => apiRequest<T>(url, { method: 'GET' }),
  post: <T = any>(url: string, body?: any) =>
    apiRequest<T>(url, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    }),
  put: <T = any>(url: string, body?: any) =>
    apiRequest<T>(url, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined
    }),
  delete: <T = any>(url: string) => apiRequest<T>(url, { method: 'DELETE' })
};
