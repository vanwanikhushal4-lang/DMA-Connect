import type { ApiCommittee, CreateUserPayload, CreateUserResponse, EmailLoginResponse } from '../lib/backend-auth';

export const backendApiUrl = (process.env.EXPO_PUBLIC_BACKEND_API_URL || '').trim().replace(/\/+$/, '');
export const backendApiEnabled = !!backendApiUrl;

export class BackendApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.name = 'BackendApiError'; this.status = status; }
}

function errorMessage(data: unknown, status: number, path: string) {
  if (data && typeof data === 'object') {
    const body = data as { message?: unknown; error?: unknown };
    if (typeof body.message === 'string' && body.message) return body.message;
    if (typeof body.error === 'string' && body.error) return body.error;
    if (body.error && typeof body.error === 'object' && 'message' in body.error && typeof body.error.message === 'string') return body.error.message;
  }
  if (status === 401) return path === '/auth/login/email' ? 'The email or password is incorrect. Please try again.' : 'Authorization is required. Sign in and try again.';
  if (status === 403) return 'Your account does not have permission for this action.';
  if (status === 409) return 'An account with these details already exists.';
  return 'The server could not complete this request. Please try again.';
}

export function createBackendApi(baseUrl: string, fetchRequest: typeof fetch = fetch) {
  const root = baseUrl.trim().replace(/\/+$/, '');
  async function request<T>(path: string, options: { body?: unknown; token?: string; signal?: AbortSignal } = {}): Promise<T> {
    if (!root) throw new Error('The application server has not been configured.');
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 15000);
    try {
      const response = await fetchRequest(`${root}/api/v1${path}`, {
        method: options.body === undefined ? 'GET' : 'POST',
        headers: { Accept: 'application/json', ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
        body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: controller.signal,
      });
      const text = await response.text();
      let data: unknown;
      try { data = text ? JSON.parse(text) : null; }
      catch { if (response.ok) throw new BackendApiError(response.status, 'The server returned an unreadable response.'); }
      if (!response.ok) throw new BackendApiError(response.status, errorMessage(data, response.status, path));
      return data as T;
    } catch (error) {
      if (error instanceof BackendApiError) throw error;
      if (options.signal?.aborted) throw error;
      throw new Error(controller.signal.aborted ? 'The server took too long to respond. Please try again.' : 'Cannot reach the application server. Check your connection and try again.');
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
    }
  }
  return {
    loginEmail: (email: string, password: string) => request<EmailLoginResponse>('/auth/login/email', { body: { email: email.trim().toLowerCase(), password } }),
    createUser: async (payload: CreateUserPayload, token?: string) => {
      const result = await request<CreateUserResponse>('/user/profile', { body: payload, token });
      if (!result || !Number.isSafeInteger(result.userId) || result.userId <= 0 || typeof result.emailNeedsVerification !== 'boolean') throw new BackendApiError(200, 'The server returned an invalid account response.');
      return result;
    },
    getAllCommittees: async (token?: string, signal?: AbortSignal) => {
      const result = await request<{ committees: ApiCommittee[] }>('/committees/getAllCommittees?active=true', { token, signal });
      if (!result || !Array.isArray(result.committees) || result.committees.some(c => !c || !Number.isSafeInteger(c.committeeId) || c.committeeId <= 0 || typeof c.name !== 'string' || typeof c.level !== 'string' || typeof c.active !== 'boolean')) {
        throw new BackendApiError(200, 'The server returned an invalid committee list.');
      }
      return result.committees;
    },
  };
}

export const backendApi = createBackendApi(backendApiUrl);
