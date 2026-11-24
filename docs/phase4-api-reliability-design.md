# Phase 4 API Reliability Design

## Understanding

- Add idempotency and duplicate-submit protection to profile updates, email sends, and member deletion.
- Add sliding-window rate limits with structured `429` responses and `Retry-After`.
- Add request correlation and structured, redacted API logs.
- Preserve the existing Firestore-backed email limit.
- Keep email failures non-fatal to the originating data mutation and handle avatar Storage failures safely.
- Preserve authentication/session flows, Firestore rules and transactions, and business calculations.

## Assumptions

- In-memory rate-limit, idempotency, and SMTP circuit state is process-local and does not coordinate across Vercel instances.
- The existing Firestore email limit remains the distributed email safeguard.
- Each client submission creates a key for that logical request; no automatic client retry loop is introduced.
- No request payload, identity, token, storage token, provider error, or UID is written to application logs.
- If an avatar upload fails and cannot use the existing inline-data fallback, the profile update fails as a whole; the name is not partially updated.

## Decisions

| Decision | Alternatives considered | Rationale |
| --- | --- | --- |
| Use shared, bounded in-memory helpers and route-specific integration. | Per-route duplicated logic; distributed Firestore guards on every route. | Keeps policy consistent without adding database writes to every mutation; matches the accepted process-local scope. |
| Authenticate before applying UID-scoped mutation guards. | Guard by IP or request key before authentication. | Avoids logging or trusting caller-supplied identity and scopes limits to verified accounts. |
| Check idempotency before consuming the local rate limit. | Consume a limit slot for every retry. | Replays of the same logical operation should not use additional quota. |
| Do not cache `429` or `5xx` responses. | Cache all completed responses. | A caller can retry after a rate window or transient server failure. |
| Preserve the Firestore-backed email cap and add a local sliding window. | Replace the Firestore cap with local state. | Keeps the existing distributed safeguard while satisfying the shared limiter requirement. |
| Add a small process-local SMTP circuit cooldown after repeated failures. | Retry each send indefinitely; add a distributed breaker. | Limits repeated calls to a failing provider without introducing persistent state or retries. |
| Keep profile updates all-or-nothing if image upload cannot fall back inline. | Commit name-only partial success. | Avoids ambiguous partial mutation and preserves the previous profile state on failed uploads. |
| Log only the allowlisted request fields and expose a correlation header. | Log raw errors or request details. | Enables request-level diagnosis without leaking sensitive data. |

## Design

Each `POST` route is wrapped by shared observability. It accepts a valid UUID request ID or creates one, attaches `x-request-id` to the response, and emits one JSON log containing only `requestId`, `route`, `method`, `step`, `status`, and `durationMs`. Internal step metadata is removed from responses unless the route's established JSON error contract includes a safe step.

After route authentication, the mutation uses a route-and-UID-scoped idempotency key and sliding-window limiter. Proposed generous limits are profile: 20/hour, email: 10/hour in addition to the existing Firestore limit, and deletion: 10/hour. Rate-limit responses use safe structured JSON and `Retry-After`. Idempotency state coalesces in-flight requests and caches completed responses for a short TTL, excluding `429` and `5xx`.

API callers send `X-Idempotency-Key`. Profile and AdminPanel submission handlers use synchronous in-flight guards, and member deletion coalesces concurrent client requests for the same member. Email provider errors are sanitized, and email remains non-fatal to the Firestore mutation that triggered the notification. A process-local SMTP breaker opens for 60 seconds after five consecutive provider failures and resets on success.

Profile Storage keeps the existing missing-bucket and bucket-not-found inline fallback. Transient upload errors may also use the data-URL fallback only when the validated image is no larger than 80KB. Otherwise, return a safe failure without partially changing profile data. Raw provider errors are never returned or logged.

## Validation

- Test sliding-window expiry and retry timing.
- Test idempotency replay, in-flight coalescing, and exclusion of `429`/`5xx` from caching.
- Verify all three routes produce structured JSON and `x-request-id`, and rate-limited requests include `Retry-After`.
- Run `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check`.
- Confirm existing auth/session behavior, Firestore rules/transactions, and calculations remain unchanged.

## Risks and limitations

- Process-local guards are not global across serverless instances; only the existing Firestore email limiter is distributed.
- A process-local SMTP breaker can be open on one instance while another instance remains healthy.
- The 80KB inline-avatar limit and Firestore document-size guard remain applicable to Storage fallbacks.
