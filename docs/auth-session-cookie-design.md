# HTTP-Only Session Cookie and Custom Claims Design

## Understanding

- Add a Firebase session-cookie API at `/api/auth/session` with `POST` to establish and synchronize a session and `DELETE` to expire it.
- Synchronize the signed-in user's Firebase custom claims from the server-side member directory.
- Guard `/dashboard/:path*` with middleware that redirects requests missing a non-empty `__session` cookie.
- Synchronize claims after existing admin promotion, demotion, activation, and deactivation writes.
- Preserve Google Sign-In, existing Firestore authorization, and `calculateMessStats`.
- Report a persisted role/status change separately from a later claims-sync failure.

## Assumptions

- `NEXT_PUBLIC_ADMIN_EMAIL` is the authoritative configured Super Admin identity.
- Member activity follows `isMemberActive`: inactive/removed status, `active === false`, `isBlocked`, or `isRemoved` makes a member inactive. Super Admin is always active.
- Expected traffic is typical for this mess-management app; existing in-process rate-limit safeguards are sufficient.
- Production requests use HTTPS. Logs must not include tokens, cookies, or credential values.
- A directory entry without a Firebase Auth account has no claims to update and is a successful no-op until an account exists.
- Firebase claims can briefly lag persisted member changes; sync errors remain visible and retryable.
- Middleware checks only cookie presence. Existing Firebase token and Firestore rules remain the data authorization boundary.

## Decisions

| Decision | Alternatives considered | Rationale |
| --- | --- | --- |
| Preserve direct Firestore member writes and add a protected server-side claims-sync endpoint. | Move member writes to an API; use a Firestore trigger. | Minimizes behavior changes and avoids requiring an unconfigured trigger service. |
| Derive role and active state only from server-side configuration and `settings/members`. | Accept claims or role values from the client. | Prevents callers from assigning arbitrary privileges. |
| Re-POST a freshly refreshed ID token after claims change. | Mint the session cookie from the pre-update token only. | Ensures the cookie includes the newly issued claims. |
| Use the existing `isMemberActive` policy and keep Super Admin always active. | Add a separate activity interpretation for claims. | Keeps claims consistent with current access and member behavior. |
| Treat a missing Firebase Auth account as a no-op; surface other sync errors as partial success with retry. | Fail the member-directory update or silently ignore errors. | No claims can exist before account creation, while operational failures should not be hidden. |
| Restrict middleware matching to dashboard paths and check cookie presence only. | Guard APIs or validate Firebase cookies in middleware. | Matches the requested early dashboard-shell redirect without duplicating API authorization. |

## Design

The Node.js `/api/auth/session` route uses `withApiObservability` and the existing rate limiter. `POST` validates the JSON body, calls `getAdminAuth().verifyIdToken(idToken)`, reads `settings/members`, and resolves `super_admin`, `admin`, or `member` plus `active`. It compares the desired `{ role, active }` with the user's existing custom claims and calls `setCustomUserClaims` only when needed. It then creates a five-day Firebase session cookie and sets `__session` with `HttpOnly`, `SameSite=Strict`, `Path=/`, and `Secure` in production. The response indicates whether claims changed. `DELETE` expires the same cookie using matching attributes.

`AuthContext` keeps the Google popup flow. On a signed-in auth-state event, it obtains the current ID token and POSTs to the session route. If claims changed, it forces an ID-token refresh and POSTs again. Explicit logout requests DELETE before client state is cleared and Firebase sign-out completes; a cookie-clear failure is surfaced without trapping the user in a signed-in client state.

A protected `/api/auth/claims` endpoint accepts a member identifier, authenticates the acting caller with a verified bearer token, and derives the target claims from Firestore rather than request fields. It permits configured Super Admin and currently active admins to sync another member. A caller may sync only their own record after a self-status change, so the subsequent authorization check does not strand a self-deactivation before claims are refreshed. The endpoint looks up the target Firebase user by the directory email; `auth/user-not-found` is a no-op, while other failures are explicit. `ManageMembers` invokes it after successful promotion/demotion or status writes, and presents retryable partial-success feedback if synchronization fails.

Middleware matches `/dashboard/:path*` only and redirects to `/` when `__session` is absent or empty. Root, API routes, and assets do not match. The cookie is a rendering gate, not a substitute for Firebase authentication or Firestore rules.

## Validation

- Run `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check`.
- Verify that the session endpoint sets and clears the expected cookie and returns whether claims changed.
- Verify that member claims are derived from Firestore and unauthorized claim-sync calls cannot assign roles.
- Verify dashboard redirects only for a missing/empty cookie and does not affect root, API, or static requests.
- Confirm member changes remain persisted when claims synchronization fails, with a visible retry path.
- Confirm the Google Sign-In flow and `calculateMessStats` remain unchanged.

## Risks and limitations

- Firebase Auth claims and Firestore cannot be updated in one atomic transaction; the UI must represent partial synchronization.
- Middleware intentionally accepts any non-empty `__session` value for the dashboard shell. Protected data still depends on Firebase token verification and Firestore rules.
- In-memory rate limiting may be process-local in serverless deployments, consistent with the existing API safeguards.
