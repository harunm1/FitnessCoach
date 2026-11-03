# Accounts: verified sign-in (Issue #14, Milestone 1)

Milestone 1 provides email/password registration, email verification, sign-in,
password recovery, a protected account page and sign-out. New accounts are FREE.
Trial activation, tier-specific feature permissions, admin bootstrap and Stripe
billing belong to the following milestones.

## Local setup

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

5. Apply the committed migrations with `npm run db:migrate`, then run `npm run dev`.
6. Open `/sign-up`, create an account using a password of 12–128 characters, and
   follow its verification email. Then sign in at `/sign-in` and open `/account`.

The seeded exercise-demo user is not an email/password credential account.
Register a new account for Milestone 1. The existing exercise seed is unchanged.

## Server contracts

- `/api/auth/[...all]` mounts Better Auth's Node.js handler.
- `src/lib/auth.ts` initializes auth and the shared Prisma client on first request,
  so a production build does not require database, mail or authentication secrets.
- `requireUser()` in `src/lib/auth/session.ts` verifies the database session and
  email verification state. Call it inside each protected page or Server Action,
  before reading or writing user data. Use its user ID, never a submitted user ID.
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
