# Accounts: sign-in and access tiers (Issue #14, Milestones 1–3)

Milestone 1 provides email/password registration, email verification, sign-in,
password recovery, a protected account page and sign-out. New accounts are FREE.
Milestone 2 adds a one-time seven-day trial, server-side permission helpers and
operator-only admin setup. Milestone 3 adds Stripe test-mode subscriptions; see
[BILLING.md](BILLING.md) for configuration and manual payment verification.

## Local setup

For the complete ordered PowerShell/Bash setup and terminal layout, start with
[LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md).

1. Install dependencies with `npm install` and start PostgreSQL with
   `docker compose up -d`.
2. Add the Better Auth and SMTP settings from `.env.example` to your existing
   `.env`. Keep your existing `DATABASE_URL`.
3. Generate your own authentication secret:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Set its output as `BETTER_AUTH_SECRET`. Set `BETTER_AUTH_URL` to the exact app
   origin, normally `http://localhost:3000`. Public deployments must use HTTPS.

4. Configure an SMTP service. For local development, Mailpit captures email without
   sending it externally:

   ```bash
   docker run --rm --name fitnesscoach-mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit:latest
   ```

   Use the local defaults in `.env.example`. Open `http://localhost:8025` to read
   verification and reset emails. For an authenticated SMTP service, set
   `SMTP_USER` and `SMTP_PASSWORD` together and choose `SMTP_PORT` and
   `SMTP_SECURE` according to that service. Restart Next.js after changing `.env`.

5. Apply existing migrations with `npx prisma migrate deploy`, then run `npm run dev`.
6. Open `/sign-up`, create an account using a password of 12–128 characters, and
   follow its verification email. Then sign in at `/sign-in` and open `/account`.

Register a new account, or opt into the four local-only tier logins described in
[QUIZ_SESSION_AUTH.md](QUIZ_SESSION_AUTH.md#optional-local-demo-logins).

## Migration name update

Before merging, the auth migration was renamed from `20261103090000_add_better_auth`
to `20261108090000_add_better_auth` so it follows the migrations already on `main`.
The SQL and its checksum are unchanged. Fresh databases need no special step.

If your local database already applied the old name, back it up first. In a
PostgreSQL query console connected to that database, rename only its successful
history record with the matching SQL checksum.

If you already tried deploying and received `P3018` with `Session already exists`,
first inspect the history:

```sql
SELECT migration_name, checksum, finished_at, rolled_back_at, applied_steps_count
FROM "_prisma_migrations"
WHERE migration_name IN (
  '20261103090000_add_better_auth', '20261108090000_add_better_auth'
);
```

Only when the old entry completed with the checksum below, the auth tables are
already complete, and the renamed attempt failed at the first `CREATE TABLE`,
mark that failed attempt rolled back before running the rename SQL:

```bash
npx prisma migrate resolve --rolled-back 20261108090000_add_better_auth
```

This changes the failed attempt's history status; it does not drop or revert any
tables. If the schema is incomplete or the checksums differ, stop and inspect it
instead of marking a partially applied migration as complete.

Then rename the successful old entry:

```sql
BEGIN;
UPDATE "_prisma_migrations"
SET migration_name = '20261108090000_add_better_auth'
WHERE migration_name = '20261103090000_add_better_auth'
  AND checksum = '43ba6f068534fb9e2a66ec299dd86977b0eabb630fb5be5efc4cdfbf03beadd1'
  AND finished_at IS NOT NULL
  AND rolled_back_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "_prisma_migrations"
    WHERE migration_name = '20261108090000_add_better_auth'
      AND rolled_back_at IS NULL
  )
RETURNING migration_name;
COMMIT;
```

Proceed with `npx prisma migrate deploy` only after this returns one renamed row,
or after confirming the new name was already recorded successfully. If neither
is true, stop and inspect the history. Do not reapply the SQL, reset the database
or delete its volume. This changes migration metadata only; accounts, sessions
and fitness records stay in place. The separate billing PR documents its own
migration rename.

## Server contracts

- `/api/auth/[...all]` mounts Better Auth's Node.js handler.
- `src/lib/auth.ts` initializes auth and the shared Prisma client on first request,
  so a production build does not require database, mail or authentication secrets.
- `requireUser()` in `src/lib/auth/session.ts` verifies the database session and
  email verification state. Call it inside each protected page or Server Action,
  before reading or writing user data. Use its user ID, never a submitted user ID.
  It returns identity, stored tier and trial expiry from the fresh server session;
  effective permissions still come from the shared access policy.
  API handlers should validate sessions and return appropriate 401/403 responses.
- The browser client uses HttpOnly session cookies. Tier and trial fields cannot
  be supplied through signup/update requests. Cookie session caching is disabled.
- Verification and reset links expire after one hour. Password reset revokes all
  existing sessions. Auth requests have database-backed rate limits.
- Email delivery runs through Next.js `after()` so authentication responses do not
  wait for SMTP. If email fails, inspect server logs and retry through
  `/verify-email` or `/forgot-password`; verification remains required.
- Configure trusted origins through `BETTER_AUTH_URL`. When deploying behind a
  proxy, ensure it sets the client-IP header used by Better Auth correctly.

## Change password while signed in

On `/account`, select **Change password**. Enter your current password, a new
12–128 character password and its confirmation. The dialog validates confirmation
and the server validates the current password. A successful change keeps the
current session through a new cookie and revokes other sessions. Cancel, Escape
or a backdrop click clears the entered fields. An expired session requires sign-in.

If you cannot authenticate, use **Forgot password** on `/sign-in`. That flow sends
an email reset link and revokes all existing sessions after the reset. See
[ACCOUNTS_TESTING.md](ACCOUNTS_TESTING.md) for positive and negative checks.

## Access tiers and the free trial

| Effective tier | Access                                      |
| -------------- | ------------------------------------------- |
| FREE           | Quiz, rule-based default plans and tracking |
| TRIAL          | FREE features and coach until trial expiry  |
| PRO            | FREE features and coach until paid expiry   |
| ADMIN          | All of the above and app content management |

On `/account`, an eligible verified FREE user can select **Start free trial**.
The trial starts at that server request and lasts exactly seven 24-hour periods.
No card is collected and nothing is charged. Signup alone does not start it.

Activation is one conditional database update scoped to the session's user ID.
Concurrent or repeated requests cannot extend the expiry. `trialEndsAt` is retained
after expiry, including when the stored tier later becomes FREE, to prevent reuse.
An expired TRIAL account has effective FREE access immediately; no scheduled job
or database rewrite is required. A legacy TRIAL account without an expiry also
has effective FREE access and cannot start another trial.

The quiz/session pages and their actions now require a verified session and scope
data to its owner (#50; [details](QUIZ_SESSION_AUTH.md)). Coach and
content-management entrypoints must enforce their permission before reading data
or doing work:

```ts
// Inside a protected Server Component:
const { user } = await requirePageAccess("coach");

// Inside each protected Server Action:
const { user } = await requirePermission("manage-content");
// Scope subsequent queries to user.id where the data belongs to that user.
```

Import these helpers from `@/lib/auth/access`. They validate the verified session,
read the current tier from PostgreSQL and check expiry on every call. They do not
trust a browser-supplied tier or an old session snapshot. Signed-out callers go to
sign-in; denied pages go to the account page, while denied actions throw
`AccessDeniedError`. Route handlers should explicitly return 401/403 as appropriate
before streaming or reading protected data. Hiding a button is not authorization.

### Admin setup

Register and verify the intended admin account using the normal signup flow.
Then an operator with access to the server's environment can run:

```bash
npx tsx scripts/create-admin.ts --email admin@your-domain.com --confirm
```

This grants ADMIN only to the selected existing, verified password account. It
does not create users, set passwords or change trial dates. It is safe to repeat.
There is no public admin signup or promotion endpoint. The optional tier fixtures
are restricted to local development. Protect database and server access, since the operator
command deliberately bypasses app permissions.

Stripe checkout, signed webhooks and paid-tier reconciliation preserve trial dates
and ADMIN access. PRO requires a current active billing record and a future
verified paid-through date; setting the user tier alone does not grant paid access.
At paid expiry, access falls back to an original unexpired trial or FREE. See
[BILLING.md](BILLING.md) for the subscription policy and setup.

## Automated checks

`npm test` runs unit tests, including the existing coach tests. Integration and
browser tests require a separate PostgreSQL database whose name ends in `_test`.
They never fall back to the development `DATABASE_URL`.

For example, start an isolated test database:

```bash
docker run --rm -d --name fitnesscoach-auth-test-db -e POSTGRES_USER=fitnesscoach -e POSTGRES_PASSWORD=fitnesscoach -e POSTGRES_DB=fitnesscoach_test -p 15432:5432 postgres:16-alpine
docker exec fitnesscoach-auth-test-db pg_isready -U fitnesscoach -d fitnesscoach_test
```

Wait until the last command reports accepting connections. Set `TEST_DATABASE_URL`
to `postgresql://fitnesscoach:fitnesscoach@localhost:15432/fitnesscoach_test?schema=public`.
In PowerShell:

```powershell
$env:TEST_DATABASE_URL="postgresql://fitnesscoach:fitnesscoach@localhost:15432/fitnesscoach_test?schema=public"
```

In Bash:

```bash
export TEST_DATABASE_URL="postgresql://fitnesscoach:fitnesscoach@localhost:15432/fitnesscoach_test?schema=public"
```

Then run:

```bash
npm run db:migrate:test
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests launch a separate production server on port 13100 and a test-only
loopback SMTP inbox on ports 11026/18027. They send no real email and use no Stripe
or production credentials. These ports must be free. Browser reports, traces and
auth state stay ignored. Stop the test database with
`docker stop fitnesscoach-auth-test-db` after testing.

GitHub Actions supplies an isolated PostgreSQL 16 service, applies the migrations,
and runs the same checks plus Chromium browser tests. SMTP is captured by the
separate test inbox, not by any application route.

Milestone 2 tests cover the expiry boundary, all four tiers, stale session tiers,
forged activation input, concurrent activation, one-time use and admin bootstrap.
Browser tests activate a trial and verify expiry and tier changes with the same
session. PRO/ADMIN assignments in these tests are isolated database fixtures, not
payment or public promotion endpoints.
