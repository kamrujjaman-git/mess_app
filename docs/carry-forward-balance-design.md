# Carry-Forward Balance Design

## Understanding

- Transfer active members' previous-month closing balances into the selected month as signed opening deposit entries.
- Keep `calculateMessStats` unchanged and use its `MemberSummary[]` as the source for preview candidates.
- Preview eligible balances before writing; allow admins to exclude members who have already settled in cash.
- Prevent duplicate carry-forwards with deterministic target deposit IDs and create-only transaction writes.
- Allow signed and future-dated values only for validated carry-forward deposits; keep ordinary deposit rules unchanged.
- Provide an admin-only modal with clear loading, empty, already-applied, success, and retry states.
- Record a best-effort immutable audit entry after successful writes.

## Assumptions

- Eligibility is based on the current `settings/members` roster because the app does not preserve monthly member snapshots.
- A member is eligible when active and `Math.abs(finalBalance) >= 0.01`.
- The modal applies the values shown in its loaded preview. To recalculate after source-month edits, the admin closes and reopens the preview.
- Existing deterministic carry-forward records are never overwritten. An excluded member remains eligible in a later preview.
- The member count is expected to be modest; writes are chunked within Firestore transaction limits. If a chunk fails after earlier chunks committed, the error is surfaced and retry fills only missing records.
- Client audit logging remains best effort and must not fail the balance write.

## Decision Log

| Decision | Alternatives considered | Rationale |
| --- | --- | --- |
| Calculate preview balances from the previous month's four datasets using the existing `calculateMessStats`. | Duplicate balance math in the feature or alter `calculateMessStats`. | Preserves a single source of truth for balances. |
| Use the current active member roster. | Reconstruct historical active members. | No historical roster snapshot exists in the data model. |
| Use deterministic source/member IDs and bounded Firestore transactions. | Pre-read plus WriteBatch; server endpoint with Admin SDK. | Transactions read target IDs and create only missing entries, preventing concurrent retries from overwriting an existing carry-forward. It fits the client Firebase architecture and existing rules. |
| Make a narrow Firestore Rules exception for signed, future first-of-month carry-forward entries. | Permit negative/future values for all deposits; block future target months. | Supports Due adjustments and any selected target month without relaxing normal deposit validation. |
| Keep the modal open after applying and show newly applied counts and totals. | Close immediately or only show a toast. | Gives admins clear completion and partial-retry feedback. |
| Use the existing lint/build/diff checks; do not install a test framework. | Add a new test dependency. | The repository has no current test runner, and adding one is outside the feature scope. |

## Design

### Calculation and source data

Add a pure `previewCarryForwardBalances(MemberSummary[])` helper to `src/lib/mess.ts`. It filters to `status === "active"` and absolute balances of at least `0.01`, preserves the signed amount, and identifies positive values as Credit and negative values as Due. Add a previous-month-key helper that handles year rollover.

When opened, `CarryForwardModal` loads prior-month meals, bazar entries, deposits, and fixed costs concurrently. It passes those values and the current roster to `calculateMessStats`, then renders the pure preview output. Existing deterministic deposit IDs for the source month are shown as already applied and cannot be selected. Other candidates are selected by default. The current target-month deposits are available from the dashboard's existing month subscription.

### Writes, idempotency, and audit

Add `applyCarryForwardBalances(sourceMonthKey, targetMonthKey, selectedBalances)` in `src/lib/firestore.ts`. The destination is `months/{targetMonthKey}/deposits`; a deterministic document ID combines `cf_`, the source month key, and an encoded member ID. Each transaction chunk reads all target references before writing and creates only missing records. The transaction never updates an existing record. Retries after partial chunk success are safe because committed deterministic IDs are skipped.

Each created record contains `memberId`, `memberName`, the signed `amount` from the preview, `date: "<targetMonth>-01"`, `carryForwardFrom: sourceMonthKey`, and a note naming the source month. Once all requested writes succeed, schedule one `recordAuditLog` entry with `category: "deposits"`, `action: "carry_forward_balance"`, and a human-readable summary of newly created credits and dues. Do not write an audit event if no records were created.

### Firestore Rules

Keep admin authorization for deposit writes. Ordinary deposits continue to require a positive amount and the existing valid, non-future date. A separate narrow validator permits a non-zero signed amount and target-month first-day date, including a future date, only when the source month is valid and earlier than the target and the record ID and carry-forward metadata are valid.

### Admin experience

Place the “Carry Forward Balance” trigger at the top level of `AdminPanel`, visible in any admin subsection for the selected month. The dedicated modal shows source-to-target labels, member name, signed Credit/Due badge, and an initially checked checkbox for each not-yet-applied member. Already-applied, no-balance, and all-applied states are explicit. Use the requested slate overlay, semantic tokens, `tabular-nums`, tactile feedback, and accessible dialog semantics.

Guard submissions with both disabled/loading state and an in-flight ref. On success, mark the new rows applied and show a count/credit/due summary. On an error, report it and refresh applied status so the admin can safely retry. The modal stays open for feedback.

## Validation

- Run `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check`.
- Directly verify the pure preview helper filters inactive/zero balances and preserves Credit/Due signs and the `0.01` threshold.
- Inspect the transaction for read-before-write ordering, missing-only creates, and safe retries after partial chunk progress.
- Inspect Firestore Rules to confirm ordinary deposits remain positive and non-future while the carry-forward exception is narrowly validated.
- Confirm `calculateMessStats` and existing deposit helpers remain unchanged in behavior.

## Risks and limitations

- The modal uses a snapshot loaded when opened, not a live subscription. Reopen it to get a fresh calculation after source-month edits.
- Client-side audit records remain best effort and are not atomic with the deposit transactions.
- Firestore Rules compiler/emulator validation depends on Firebase CLI availability in the implementation environment.
