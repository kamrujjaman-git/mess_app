const MAX_RATE_LIMIT_KEYS = 10000;

interface RateLimitWindow {
  timestamps: number[];
  expiresAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface RateLimitOptions {
  limit: number;
  windowMs: number;
  now?: number;
}

const requestWindows = new Map<string, RateLimitWindow>();

function cleanupExpiredWindows(now: number) {
  for (const [key, window] of requestWindows) {
    if (window.expiresAt <= now) requestWindows.delete(key);
  }

  if (requestWindows.size <= MAX_RATE_LIMIT_KEYS) return;
  for (const key of requestWindows.keys()) {
    requestWindows.delete(key);
    if (requestWindows.size <= MAX_RATE_LIMIT_KEYS) break;
  }
}

export function consumeRateLimit(
  key: string,
  { limit, windowMs, now = Date.now() }: RateLimitOptions
): RateLimitResult {
  cleanupExpiredWindows(now);
  const windowStart = now - windowMs;
  const current = requestWindows.get(key);
  const timestamps = current?.timestamps.filter((timestamp) => timestamp > windowStart) ?? [];

  if (timestamps.length >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((timestamps[0] + windowMs - now) / 1000)
    );
    requestWindows.set(key, {
      timestamps,
      expiresAt: timestamps[timestamps.length - 1] + windowMs,
    });
    return { allowed: false, retryAfterSeconds };
  }

  timestamps.push(now);
  requestWindows.set(key, {
    timestamps,
    expiresAt: timestamps[timestamps.length - 1] + windowMs,
  });
  return { allowed: true, retryAfterSeconds: 0 };
}

export function rateLimitResponse(
  retryAfterSeconds: number,
  message = "Too many requests. Please try again later."
): Response {
  const retryAfter = Math.max(1, Math.ceil(retryAfterSeconds));
  return Response.json(
    {
      ok: false,
      error: message,
      step: "rate-limit",
      retryAfterSeconds: retryAfter,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "Cache-Control": "no-store",
        "x-internal-api-step": "rate-limit",
      },
    }
  );
}
