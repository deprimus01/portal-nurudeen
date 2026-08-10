import { ApiError, isNetworkFailure } from './api';

/**
 * Every error shown to a user falls into one of these buckets. Used to
 * pick a consistent icon/tone/action in ErrorState, and to decide what a
 * catch block should say when the error isn't an ApiError (e.g. the
 * device is offline).
 */
export type ErrorKind = 'validation' | 'network' | 'auth' | 'permission' | 'not-found' | 'server' | 'unknown';

export interface ErrorInfo {
  kind: ErrorKind;
  /** Short, calm, user-facing message. Never contains raw backend/DB/HTTP text. */
  message: string;
  /** Only present for ApiError - the exact backend response, for developers. */
  devMessage?: string;
  status?: number;
}

/**
 * Classifies any caught error into a consistent {kind, message}. ApiError
 * messages are already translated to plain language in lib/api.ts (by
 * status code), so this mostly just labels the kind for UI purposes and
 * handles the non-ApiError cases (network failures, unexpected JS errors)
 * that never reach the backend at all.
 */
export function classifyError(err: unknown, fallback = 'Something went wrong. Please try again.'): ErrorInfo {
  if (err instanceof ApiError) {
    let kind: ErrorKind = 'unknown';
    if (err.status === 401) kind = 'auth';
    else if (err.status === 403) kind = 'permission';
    else if (err.status === 404) kind = 'not-found';
    else if (err.status === 400 || err.status === 409 || err.status === 422) kind = 'validation';
    else if (err.status >= 500) kind = 'server';
    return { kind, message: err.message, devMessage: err.devMessage, status: err.status };
  }
  if (isNetworkFailure(err)) {
    return { kind: 'network', message: "Check your internet connection and try again." };
  }
  // Something unexpected happened on the client (a bug, a bad response
  // shape, etc.) - never show the raw JS error/stack to the user, but do
  // log it so it's not silently lost for developers.
  if (process.env.NODE_ENV !== 'production' && err) {
    // eslint-disable-next-line no-console
    console.error('[Unhandled error]', err);
  }
  return { kind: 'unknown', message: fallback };
}

/**
 * Drop-in replacement for the old `err instanceof ApiError ? err.message
 * : 'Failed to ...'` pattern used throughout the app - same call shape,
 * but now also gives a proper "check your connection" message for
 * network failures instead of the generic fallback.
 */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  return classifyError(err, fallback).message;
}
