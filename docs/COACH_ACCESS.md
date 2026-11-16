# Coach access and plan request limits (Issue #51)

## Current integration

The shared guards and database reservation are implemented. The existing
`askExerciseCoach` Server Action checks the verified session and effective coach
access before model setup. Denied tiers receive its normal error state without
a model call or chat write. Signed-out callers retain #104's sign-in redirect.

The general chat route and AI-personalization Server Action are not on main yet.
Those caller changes belong with #53/#56/#63 and #58. Keep #51 open until they
adopt these helpers and are tested. This branch temporarily builds on PR #105
to retain the private-history fix; update from main after that PR merges.

## Tier and session contracts

| Effective tier | Request an AI plan | Coach chat |
| -------------- | ------------------ | ---------- |
| FREE           | Yes                | No         |
| Active TRIAL   | Yes                | Yes        |
| Expired TRIAL  | Yes, as FREE       | No         |
| PRO            | Yes                | Yes        |
| ADMIN          | Yes                | Yes        |

`effectiveTier(user, now)` and `canUseCoachChat(tier)` in `src/lib/auth/tier.ts`
reuse the account policy. PRO requires an active billing record and a future
`paidUntil`; a stored PRO label alone does not grant access. Remaining trial
time can still grant TRIAL after paid access ends. ADMIN is preserved.

`getVerifiedUser()` returns a nullable verified session identity without a
redirect. `requireUser()` keeps its existing redirect and #50's identity, tier
and trial fields. Cookie caching remains disabled.

`requireTier(allowed)` reads fresh account and billing data for that session:

- `{ ok: true, user, access }` for an allowed effective tier.
- `{ ok: false, status: 401, code: "UNAUTHENTICATED", message }` without a
  verified account.
- `{ ok: false, status: 403, code: "FORBIDDEN", message }` for insufficient access.

Expected denials are values. Database failures still throw: the caller must
stop and return a generic service error, without model work or database details.
Pages can keep using the existing redirecting account guards.

Before opening a chat stream, the route should use:

```ts
const account = await requireTier(COACH_TIERS);
if (!account.ok) {
  return Response.json(
    { code: account.code, message: account.message },
    { status: account.status },
  );
}
// Load only account.user.id's conversation, then start the coach.
```

The route also needs its normal error handler for unexpected failures.

## Reserve one plan request every 60 seconds

`claimCoachPlanRequest(prisma, userId)` atomically reserves a slot in
`User.lastCoachPlanRequestedAt`, using PostgreSQL's clock. The ID must come from
the verified session. It returns `allowed`, `retryAfterSeconds` and, on denial,
a message such as `Please wait 37 seconds before requesting another plan.`

Only one concurrent request for a user can succeed, even across server
instances. Denied retries do not extend the window. At exactly 60 seconds,
another request is eligible. Every tier, including ADMIN, uses the same limit.

The issue mentions the newest coach plan or CoachEvent. This implementation
retains the earlier branch's dedicated request marker so failures and
simultaneous requests count before any plan is saved, without depending on
#52's event storage. Explain this design choice in the #51 PR.

The personalization action must:

1. Call `requireTier(PLAN_TIERS)` and return its normal error state on denial.
2. Validate input and load only the signed-in user's required profile data.
   Invalid input must not consume a slot.
3. Call `claimCoachPlanRequest(prisma, account.user.id)` outside the save
   transaction. On denial, return its message and `retryAfterSeconds`.
4. Start the existing provider/verifier/save pipeline only after admission.
   Provider retries share one reservation; failure does not refund it.

No transaction stays open during a model call. Onboarding's instant rule-based
plan, plan reads, logging and chat do not consume the plan allowance. The internal
timestamp is not editable through Better Auth. Database failures and missing or
unverified accounts never permit model work. Per-user pacing does not replace
provider retries/fallback: users still share the configured API key's quota.

## Setup and migration history

For a database using main's migrations:

```bash
npx prisma migrate deploy
npx prisma generate
npm run dev
```

`20261112141041_coach_plan_request_limit` adds one nullable timestamp column.
It does not reset users, trial dates, billing or workouts.

If the old local `20261106225938_coach_plan_request_limit` already ran, back up
the database and inspect its history before deploy. The SQL files are identical:

```text
SHA-256: 3004597bfc4bb6e469f1575ccda042940afbfb36ad8dc54b75554bb269b63232
```

Inspect the records and confirm the nullable `User.lastCoachPlanRequestedAt`
timestamp column exists:

```sql
SELECT migration_name, checksum, finished_at, rolled_back_at
FROM "_prisma_migrations"
WHERE migration_name IN (
  '20261106225938_coach_plan_request_limit',
  '20261112141041_coach_plan_request_limit'
);
```

Only when the original completed successfully, its checksum matches and the
column matches the migration, align its history with this guarded update:

```sql
BEGIN;
UPDATE "_prisma_migrations"
SET migration_name = '20261112141041_coach_plan_request_limit'
WHERE migration_name = '20261106225938_coach_plan_request_limit'
  AND checksum = '3004597bfc4bb6e469f1575ccda042940afbfb36ad8dc54b75554bb269b63232'
  AND finished_at IS NOT NULL
  AND rolled_back_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "_prisma_migrations"
    WHERE migration_name = '20261112141041_coach_plan_request_limit'
      AND rolled_back_at IS NULL
  )
RETURNING migration_name;
COMMIT;
```

If a new-name retry already failed on `ADD COLUMN` because this same column
exists, first confirm the original completed and the retry made no change.
Then mark only the failed retry rolled back before the guarded history update:

```bash
npx prisma migrate resolve --rolled-back 20261112141041_coach_plan_request_limit
```

Run deploy and generate again after alignment. If those checks do not match,
investigate instead of resetting the database or marking a migration applied.
These recovery steps were not run against your development database here.

## Verification

Use the isolated `_test` database in [ACCOUNTS.md](ACCOUNTS.md#automated-checks):

```bash
npm run db:migrate:test
npm test
npm run test:integration
npm run build
npm run test:e2e
```

Unit tests use fixed times for trial/paid expiry and the 59,999/60,000/60,001 ms
boundaries. PostgreSQL tests cover concurrent claims through separate clients,
independent users, persistence, unchanged cooldowns on retries and attempts to
edit the timestamp through the account API. Exercise-chat tests verify denied
tiers never reach the model, active entitlements work and expiry takes effect
in the same session. Quiz and logging remain available to all verified tiers.
