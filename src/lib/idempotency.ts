const IDEMPOTENCY_TTL_MS = 2 * 60 * 1000;
const MAX_IDEMPOTENCY_ENTRIES = 5000;

interface IdempotencyEntry {
  response: Promise<Response>;
  expiresAt: number;
  inFlight: boolean;
}

const idempotencyEntries = new Map<string, IdempotencyEntry>();

export function createIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

function isValidIdempotencyKey(key: string): boolean {
  return /^[A-Za-z0-9._:-]{8,128}$/.test(key);
}

function removeExpiredEntries(now: number) {
  for (const [key, entry] of idempotencyEntries) {
    if (!entry.inFlight && entry.expiresAt <= now) {
      idempotencyEntries.delete(key);
    }
  }

  if (idempotencyEntries.size <= MAX_IDEMPOTENCY_ENTRIES) return;
  for (const [key, entry] of idempotencyEntries) {
    if (!entry.inFlight) idempotencyEntries.delete(key);
    if (idempotencyEntries.size <= MAX_IDEMPOTENCY_ENTRIES) break;
  }
}

export async function withIdempotency(
  request: Request,
  scope: string,
  handler: () => Promise<Response>
): Promise<Response> {
  const key = request.headers.get("x-idempotency-key")?.trim() ?? "";
  if (!isValidIdempotencyKey(key)) {
    return Response.json(
      { ok: false, error: "A valid idempotency key is required.", step: "idempotency" },
      { status: 400, headers: { "x-internal-api-step": "idempotency" } }
    );
  }

  const now = Date.now();
  removeExpiredEntries(now);
  const cacheKey = JSON.stringify([scope, key]);
  const existing = idempotencyEntries.get(cacheKey);
  if (existing && (existing.inFlight || existing.expiresAt > now)) {
    return (await existing.response).clone();
  }
  if (idempotencyEntries.size >= MAX_IDEMPOTENCY_ENTRIES) {
    return Response.json(
      { ok: false, error: "Request protection is temporarily busy. Try again shortly.", step: "idempotency" },
      {
        status: 503,
        headers: { "x-internal-api-step": "idempotency" },
      }
    );
  }

  let resolveResponse!: (response: Response) => void;
  const response = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });
  const entry: IdempotencyEntry = {
    response,
    expiresAt: Number.POSITIVE_INFINITY,
    inFlight: true,
  };
  idempotencyEntries.set(cacheKey, entry);

  try {
    const result = await handler();
    entry.inFlight = false;
    entry.expiresAt = Date.now() + IDEMPOTENCY_TTL_MS;
    if (result.status === 429 || result.status >= 500) {
      idempotencyEntries.delete(cacheKey);
    }
    resolveResponse(result.clone());
    return result;
  } catch (error) {
    idempotencyEntries.delete(cacheKey);
    resolveResponse(
      Response.json(
        { ok: false, error: "The request could not be completed.", step: "idempotency" },
        { status: 500, headers: { "x-internal-api-step": "idempotency" } }
      )
    );
    throw error;
  }
}
