# Signed-in quiz and workout sessions (Issue #50)

The quiz and session use the verified account that is signed in. `/onboarding`
and `/session` redirect signed-out visitors to `/sign-in`. The quiz, start/resume,
set logging, run metrics and finish actions check the session again on each call,
including calls made directly rather than through the page.

All four tiers can use the quiz, rule-based plan and workout logging. No model
key or Stripe subscription is required for this core flow. Coach permissions
still use the shared access policy and verified billing state.

## Ownership

`requireUser()` returns `id`, `name`, `email`, `tier` and `trialEndsAt` from a fresh
server session with cookie caching disabled. The tier is stored account data;
use `resolveAccess` or the permission helpers for effective coach access, expiry
and paid entitlements. A stored PRO tier alone does not prove payment.

Profile, plan and workout queries use the session's `user.id`. An exercise ID
submitted to `logSet` must belong to the signed-in user's current plan day.
Client-supplied owner, plan and workout fields cannot select a different user.
Mutation targets are found on the server and writes retain their owner scope.

The old `demo@fitnesscoach.local` lookup is gone from these pages and actions.
Existing demo workouts stay with that user; they are not reassigned to someone
who signs in. Complete the quiz once with your own account to create your plan.

## Optional local demo logins

Normal signup and verification still work as described in
[ACCOUNTS.md](ACCOUNTS.md). For local testing of all tiers:

1. Add a unique development-only password, 12–128 characters long, as
   `DEMO_PASSWORD` in your private `.env`. It has no committed default.
2. Start local PostgreSQL, apply migrations, and seed. If the database used the
   older accounts branch, complete the
   [migration name update](ACCOUNTS.md#migration-name-update) first:

   ```bash
   docker compose up -d
   npx prisma migrate deploy
   npm run db:seed
   npm run dev
   ```

3. Sign in with one of these addresses and the initial password from `.env`:

   | Address                         | Initial access                                     |
   | ------------------------------- | -------------------------------------------------- |
   | `demo-free@fitnesscoach.local`  | FREE                                               |
   | `demo-trial@fitnesscoach.local` | TRIAL, ending seven days after its first seed      |
   | `demo-pro@fitnesscoach.local`   | PRO with a synthetic local entitlement for 30 days |
   | `demo-admin@fitnesscoach.local` | ADMIN                                              |

These accounts are verified and use Better Auth password hashes. They are
created only when `DEMO_PASSWORD` is supplied, outside production, with a
PostgreSQL URL whose host is `localhost`, `127.0.0.1` or `[::1]`. Remote databases
are rejected. Leave `DEMO_PASSWORD` blank for the normal exercise/legacy-demo
seed without these credential fixtures.

The PRO record has `cus_local_demo_` and `sub_local_demo_` IDs. It supports offline
access testing and is not evidence of a Stripe purchase. Use a separate normal
signup for Checkout, the portal and billing refresh; those synthetic IDs do not
exist in Stripe. Follow [BILLING.md](BILLING.md) for actual sandbox payments.

Rerunning the seed preserves existing fixture passwords, trial expiry, billing
deadlines and saved training data. Changing `DEMO_PASSWORD` later does not reset
existing passwords; use the account password dialog or recovery flow. An expired
trial remains expired. Existing accounts at a reserved demo address are not
converted or promoted; an unverified account or one without password credentials
stops fixture creation, and the fixture transaction is rolled back.

The exercise import and the legacy demo user are retained. The seed never prints
the password or its hash. No application endpoint creates these privileged
fixtures or accepts a requested tier from the browser.

## Verification

Use the isolated test database from [ACCOUNTS.md](ACCOUNTS.md#automated-checks),
never your development database:

```bash
npm run db:migrate:test
npm run test:integration
npm run build
npm run test:e2e
```

The integration suite calls the real actions with Better Auth sessions and a
real PostgreSQL database. It checks signed-out and revoked sessions, current
tier fields, cross-user plan isolation, forged owner/workout inputs, private
exercise rejection and owner-scoped set/run/finish writes. Seed tests check
all four logins, PRO fixture access, rollback and safe reruns. Browser tests cover
the signed-in quiz → plan → workout → set/run logs → finish flow while another
user's plan and workout stay unchanged.
