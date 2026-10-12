/**
 * Thin client-side fetch helper for calling the FastAPI backend with the
 * signed-in user's backend JWT (from the NextAuth session).
 */
import { signOut } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** An API error with its HTTP status, so callers can react to e.g. 403 (plan limits). */
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function errorMessage(status: number, detail: unknown): string {
  if (typeof detail === 'string') return detail;
  // FastAPI validation errors (422) are a list of {msg, loc, ...}.
  if (Array.isArray(detail)) {
    const msgs = detail.map((d: any) => d?.msg).filter(Boolean);
    if (msgs.length) return msgs.join('; ');
  }
  if (status >= 500) return `The server had a problem (${status}). Please try again.`;
  return `Request failed: ${status}`;
}

export async function apiFetch(path: string, backendToken: string, init: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${backendToken}`,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // The API token expired or was revoked ("sign out of all devices"): end the
    // web session too, instead of leaving pages that fail on every request.
    if (res.status === 401) signOut({ callbackUrl: '/login' });
    throw new ApiError(errorMessage(res.status, body.detail), res.status);
  }
  return res.json();
}
