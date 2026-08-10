import { getCachedResponse, setCachedResponse } from './db';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const TOKEN_KEY = 'nuruddeen_sms_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  field?: string;
  /** The raw, unmodified message from the backend - always available for
   *  logging/debugging, but never shown to the person using the app.
   *  `message` above is what gets displayed; this is what a developer
   *  would want in the console. */
  devMessage: string;

  constructor(message: string, status: number, field?: string, devMessage?: string) {
    super(message);
    this.status = status;
    this.field = field;
    this.devMessage = devMessage ?? message;
  }
}

// Translates a raw backend error (status code + message) into something
// safe and calm to show a non-technical person. The backend already
// avoids leaking stack traces/DB errors (see errorHandler.js), but status
// codes like 401/403/500 still map to developer-flavored defaults
// ("Unauthorized", "Not found.") that read fine in a REST client but
// badly in a school portal. Field-level validation messages (400) and
// conflict messages (409) are written by the backend to already be
// human-readable, so those pass through unchanged.
function toFriendlyMessage(status: number, rawMessage: string, field?: string): string {
  switch (status) {
    case 401:
      return 'Your session has ended. Please sign in again.';
    case 403:
      return "You don't have permission to do that.";
    case 404:
      return "We couldn't find what you were looking for.";
    case 429:
      return rawMessage; // already a calm, specific rate-limit message
    case 400:
    case 409:
    case 422:
      return field || rawMessage ? rawMessage : 'Please check the information you entered and try again.';
    default:
      if (status >= 500) return 'Something went wrong on our end. Please try again in a moment.';
      return rawMessage || 'Something went wrong. Please try again.';
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
}

export interface CacheAwareResult<T> {
  data: T;
  fromCache: boolean;
  cachedAt?: number;
}

// True only for an actual network failure (device is offline, DNS
// failure, request aborted, etc.) - never for a real HTTP error response.
// fetch() rejects with a TypeError for network failures; a 4xx/5xx
// response resolves normally and is handled separately as an ApiError.
// Falling back to cache on a real 403/500 would silently hide an actual
// problem behind stale data, which is exactly what §2.5's "data
// correctness first" principle rules out.
export function isNetworkFailure(err: unknown): boolean {
  return err instanceof TypeError;
}

async function requestWithCacheMeta<T>(path: string, options: RequestOptions = {}): Promise<CacheAwareResult<T>> {
  const token = getToken();
  const method = options.method || 'GET';
  const cacheable = method === 'GET';

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // A 401 means the session is dead - clear it so the app doesn't keep
      // sending a stale token and looping on auth errors.
      if (res.status === 401) {
        clearToken();
      }
      const rawMessage = data?.error || 'Something went wrong.';
      // Always keep the raw backend message reachable in devtools (as
      // devMessage, and logged here) - only the text shown in the UI is
      // softened, nothing useful to a developer is thrown away.
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error(`[API ${res.status}] ${path} ->`, rawMessage);
      }
      throw new ApiError(toFriendlyMessage(res.status, rawMessage, data?.field), res.status, data?.field, rawMessage);
    }

    if (cacheable) {
      // Fire-and-forget - a slow/failed cache write should never delay
      // or break the response the caller is actually waiting on.
      setCachedResponse(path, data);
    }

    return { data: data as T, fromCache: false };
  } catch (err) {
    if (cacheable && isNetworkFailure(err)) {
      const cached = await getCachedResponse(path);
      if (cached) {
        return { data: cached.data as T, fromCache: true, cachedAt: cached.cachedAt };
      }
    }
    throw err;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const result = await requestWithCacheMeta<T>(path, options);
  return result.data;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  // Same as `get`, but returns whether the data came from the offline
  // cache (and when it was cached) so a view can show a "you're offline -
  // showing data from earlier" banner instead of presenting stale data
  // as if it were live.
  getWithCache: <T>(path: string) => requestWithCacheMeta<T>(path),
  post: <T>(path: string, body: unknown) => apiRequest<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'DELETE', body }),
};
