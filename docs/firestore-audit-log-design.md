# Firestore Claims Hardening and Audit Log Design

## Understanding

- Preserve existing member, meal, bazar, deposit, fixed-cost, and `calculateMessStats` behavior.
- Accept either active Firebase custom claims or the existing `settings/members` directory during zero-downtime migration.
- Add admin-only reads and validated active-admin creates for immutable `audit_logs`.
- Record meaningful mutation events without allowing audit failures to fail the underlying operation.
- Add server-side audit entries for member deletion and changed custom claims.
- Add a responsive admin-only Activity Log with category filters and paginated history.

## Assumptions

- Mutation volume is modest; the viewer loads the latest 100 entries and fetches older pages on demand.
- Client audit writes are best effort and may be absent if Firestore rejects or cannot complete the follow-up write. Failures are reported through generic diagnostics without event contents or credentials.
- `createdAt` uses Firestore server time and is checked against `request.time` by client-write rules.
- Admin SDK writes bypass Firestore rules, so the server-only writer validates the same schema before writing.
- Claims and directory authorization use an OR during migration. A stale positive claim may remain effective until the user's ID token refreshes.
- Existing mutable `activity_logs` remain in place and are not repurposed or deleted.
- Member audit entries use the current month key where there is no natural transaction month.

## Decisions

| Decision | Alternatives considered | Rationale |
| --- | --- | --- |
| Use claims OR the existing active/admin directory arrays. | Require directory membership whenever claims exist. | Provides zero-downtime access for legacy tokens and newly synchronized claims; stale-positive-claim behavior is explicitly accepted. |
| Write a separate immutable `audit_logs` collection after primary client writes. | Add audit writes to the existing transaction; use Firestore triggers. | Best-effort follow-up writes cannot block existing mutations and require no Functions deployment. |
| Keep the current `activity_logs` transaction behavior unchanged. | Replace or migrate the legacy collection. | Avoids changing established mutation behavior or existing consumers. |
| Write server audit entries only after successful server-side changes. | Log failed attempts or every idempotent retry. | Keeps the audit trail focused on completed state changes and avoids retry noise. |
| Use bounded pages of 100, ordered by server timestamp descending. | Read the entire collection at once. | Keeps reads bounded while preserving access to older history. |
| Add a Fixed Costs filter in addition to the requested pills. | Show fixed-cost events only under All. | Makes the required fixed-cost events directly filterable. |

## Design

### Authorization and schema

Rules retain verified-email requirements. Active access accepts `request.auth.token.active == true` or a normalized `activeEmails` match. Admin access accepts an active `admin`/`super_admin` claim or an active directory admin whose email appears in `adminEmails`; the existing configured Super Admin email remains a migration fallback. Existing rules use these helpers without relaxing existing member/document validation.

`audit_logs` requires exactly `action`, `category`, `actorEmail`, `actorName`, `summary`, `monthKey`, and `createdAt`. Values are type-checked and length-bounded; category is an allowed enum; month keys are valid `YYYY-MM`; actor email must match the verified caller; and client `createdAt` must equal `request.time`. Admins can read, active admins can create, and client update/delete are always denied.

### Writers

The client `recordAuditLog` writes with `serverTimestamp()` and catches its own errors. Mutation helpers invoke it without awaiting after the corresponding operation succeeds. Entries cover meal save/delete; bazar and deposit add/edit/delete; whole-month and individual fixed-cost updates; member add; promotion/demotion; and status changes. Existing `activity_logs` transaction entries remain unchanged.

A server-only writer validates the schema and uses Admin Firestore. `/api/delete-member` records the deleted member after its data-cleanup transaction succeeds. `/api/auth/claims` records a distinct member-category event only when claims actually change. These follow-up writes do not alter the success result of the primary operation.

### Viewer and deployment

The Admin sidebar routes `activity-log` to a read-only `ActivityLog` component. It fetches 100 newest entries ordered by `createdAt`, loads older pages with a document cursor, and provides All, Meals, Bazar, Deposits, Members, and Fixed Costs filters. Each entry displays actor, timestamp, category, and summary using existing semantic tokens.

README deployment guidance checks normalized `activeEmails` and active-admin `adminEmails` in `settings/members` before deploying with `firebase deploy --only firestore:rules`.

## Validation

- Run `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check`.
- Review rule paths to confirm audit reads/creates are admin-only and audit update/delete are denied.
- Verify all listed mutation helpers schedule a best-effort audit write only after successful data persistence.
- Verify the viewer is rendered only inside the existing admin-only dashboard section and paginates without an unbounded query.
- Confirm `calculateMessStats` and existing workflows remain unchanged.

## Risks and limitations

- With claims OR directory fallback, stale positive claims may remain effective until token refresh; this is the accepted migration behavior.
- Best-effort audit records are not atomic with client mutations and can be missing after a failed follow-up write.
- The legacy `activity_logs` collection remains separate and keeps its current permissions and behavior.
