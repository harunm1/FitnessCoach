# Local development: accounts, access tiers and billing

Start here for Milestones 1–3 of Issue #14. [ACCOUNTS.md](ACCOUNTS.md) explains
account behavior and integration contracts; [BILLING.md](BILLING.md) explains
Stripe; [ACCOUNTS_TESTING.md](ACCOUNTS_TESTING.md) contains acceptance checks.

## Prerequisites

- Node.js 22 (22.12 or newer; CI uses Node 22), npm and Git.
- Docker Desktop with Compose. Start Docker Desktop first; enable WSL integration
  if running commands from WSL. Use Windows Node/npm in PowerShell, or Linux
  Node/npm in WSL; do not share native `node_modules` between the two.
- A Stripe sandbox and Stripe CLI only when testing billing. Auth, free access
  and the cardless trial work without Stripe settings.

Use the accounts feature branch containing the milestone changes. Uncommitted
files exist only on the machine where they were edited; a fresh clone includes
only pushed commits. Run every npm command from the folder containing package.json.

## 1. Install and create the environment

```powershell
npm install
```

For a fresh setup only, copy the template:

```powershell
Copy-Item .env.example .env
```

Bash equivalent: `cp .env.example .env`. Preserve an existing `.env` rather than
copying over configured values. `.env` stays private; `.env.example` contains
names, explanations and empty secret placeholders.

Generate a local authentication secret once:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the output into `BETTER_AUTH_SECRET` in `.env`. Keep it stable across normal
restarts; changing it can invalidate existing authentication cookies. Set
`BETTER_AUTH_URL=http://localhost:3000` and open that exact origin. Use HTTPS for
public deployments.

| Variable                     | Purpose and local setting                                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`               | Required PostgreSQL connection; use the existing template URL below.                                                          |
| `BETTER_AUTH_SECRET`         | Required private random value, at least 32 characters.                                                                        |
| `BETTER_AUTH_URL`            | Required app origin, normally `http://localhost:3000`.                                                                        |
| `SMTP_HOST`                  | `localhost` for Mailpit, or your SMTP provider's host.                                                                        |
| `SMTP_PORT`                  | `1025` for Mailpit; use the provider's specified port otherwise.                                                              |
| `SMTP_SECURE`                | `false` locally; commonly `true` for implicit TLS on 465 and `false` for STARTTLS on 587. Follow the provider's instructions. |
| `SMTP_FROM`                  | Sender name/address; use a provider-approved address for real mail.                                                           |
| `SMTP_USER`, `SMTP_PASSWORD` | Leave both blank for Mailpit; configure both for authenticated SMTP.                                                          |
| `STRIPE_SECRET_KEY`          | Optional sandbox server key, beginning `sk_test_`.                                                                            |
| `STRIPE_WEBHOOK_SECRET`      | Optional local listener's `whsec_` value; required when enabling billing.                                                     |
| `STRIPE_MONTHLY_PRICE_ID`    | Optional `price_` ID for the monthly recurring price.                                                                         |
| `STRIPE_YEARLY_PRICE_ID`     | Optional `price_` ID for the annual recurring price.                                                                          |
| `STRIPE_PRICE_ID`            | Legacy single-price compatibility ID. Retain it while existing subscriptions use it.                                          |
| `TEST_DATABASE_URL`          | Tests only; must explicitly name a separate database ending `_test`. Never use the development database.                      |

Configure both named Stripe prices to offer both options. Amounts/currency are
read from Stripe; they are not trusted from the browser. Existing project test
prices are CAD 10/month and CAD 100/year, with annual billing paid upfront.

## 2. Start PostgreSQL — setup terminal

Docker runs PostgreSQL only. Next.js runs through npm on your computer.

```powershell
docker compose up -d
docker compose ps
```

Wait for `postgres` to report healthy. The local connection is:

```dotenv
DATABASE_URL="postgresql://fitnesscoach:fitnesscoach@localhost:5432/fitnesscoach?schema=public"
```

Host: localhost; port: 5432; database/user/password: fitnesscoach. Data persists
in a named Docker volume. Do not delete it to troubleshoot an authentication error.

If this database used the older accounts branch, first follow the
[auth migration name update](ACCOUNTS.md#migration-name-update). It also covers
an already-failed deploy reporting that `Session` exists; preserve your tables
and data rather than resetting them.

Apply existing migration files without generating a new migration:

```powershell
npx prisma migrate deploy
npm run db:seed
```

`npm install` generates the Prisma client through postinstall. If the schema/client
needs refreshing, run `npx prisma generate`. Use `npm run db:migrate` when actually
creating a schema migration; ordinary setup uses the committed migration files.
The seed imports exercises and the legacy demo user. That demo is not a password-login
account; register your own account. Seeding is not needed for each app restart.

For optional verified local logins in all four tiers, set `DEMO_PASSWORD` in your
private `.env` before seeding. These fixtures are restricted to localhost and
non-production use; the PRO fixture is synthetic and does not use Stripe.
See [QUIZ_SESSION_AUTH.md](QUIZ_SESSION_AUTH.md#optional-local-demo-logins).

## 3. Start Mailpit — mail terminal

```powershell
docker run --rm --name fitnesscoach-mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit:latest
```

Keep it running and open http://localhost:8025. Verification and recovery emails
appear there; Mailpit intentionally does not deliver them to external inboxes.
For an existing container, inspect `docker ps -a` and use `docker start
fitnesscoach-mailpit` rather than creating a conflicting second container.

To send real email, replace SMTP host/port/sender and both authentication values
with your provider's settings, then restart Next.js. Real inbox delivery depends
on that provider and is not established by Mailpit tests.

## 4. Optional Stripe setup — listener terminal

Follow [BILLING.md](BILLING.md) to create the product/prices, configure the portal
and add private settings. Install the [Stripe CLI](https://docs.stripe.com/stripe-cli),
then run:

```powershell
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Authenticate to the same sandbox as your key and prices. Put this listener's
signing secret in `STRIPE_WEBHOOK_SECRET`. It differs from a Dashboard endpoint
secret. Keep the listener open while testing; unrelated signed events are safely
ignored. The app rejects live keys and live events.

Configure the default customer portal for cancellation **at period end**, payment
method updates and invoice history. Keep plan/quantity changes disabled. Do not
change another subscription while testing a fixture account.

## 5. Start Next.js — app terminal

```powershell
npm run dev
```

Open http://localhost:3000. If the app chooses another port because 3000 is busy,
stop the duplicate server or deliberately update both BETTER_AUTH_URL and the
listener target to match. Restart the app after changing `.env`. One app process
should own the development port.

1. Open `/sign-up`, enter your name/email and a 12–128 character password.
2. Open the verification email in Mailpit and follow its link.
3. Sign in at `/sign-in`; `/account` shows your current server-checked access.
4. Start the free trial only when ready. It lasts seven days without a card.
5. Use Change password on the account page when signed in. Use Forgot password
   on sign-in for email recovery when you cannot authenticate.
6. With billing configured, choose Monthly or Yearly and select Upgrade to PRO
   (test). Verify the recurring amount/currency in hosted Checkout. After a
   successful test payment, PRO and coach access refresh in the same login.

See [the acceptance matrix](ACCOUNTS_TESTING.md) for every expected outcome,
including negative cases and cancellation/renewal verification.

## Normal restart and shutdown

For later sessions, start Docker Desktop, PostgreSQL, Mailpit if needed and the
Stripe listener if testing billing, then `npm run dev`. Keep existing secrets and
data; dependency installation, migrations and seed are not daily restart steps.

Stop Next.js, Mailpit or the listener with Ctrl+C in their terminals. Stop the
database without deleting data:

```powershell
docker compose down
```

Destructive reset, only when intentionally discarding all local database data:

```powershell
docker compose down -v
```

After a reset, restart PostgreSQL, apply migrations and seed again. Source-code
backups do not back up PostgreSQL or cancel Stripe subscriptions. Coordinate
migration-aware rollback rather than resetting a database containing useful data.

## Troubleshooting

| Symptom                                        | Check/action                                                                                                                                                                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing script `db:migrate`                    | Confirm the repository root and intended branch, then `npm run`.                                                                                                                                                                          |
| P1000 credentials failure                      | Confirm DATABASE_URL and `docker compose ps`; check for another PostgreSQL service using port 5432. Existing volumes retain their original credentials even if Compose values change. Preserve data while correcting the connection/role. |
| Port 3000 already used                         | Stop the other FitnessCoach server; avoid running two dev servers.                                                                                                                                                                        |
| Missing auth secret                            | Generate a private value, set BETTER_AUTH_SECRET and restart.                                                                                                                                                                             |
| Verification/reset email absent                | Check Mailpit and SMTP settings. Resend through the UI; unverified users cannot sign in.                                                                                                                                                  |
| `stripe` not recognized                        | Install the CLI, reopen the terminal and run `stripe --version`.                                                                                                                                                                          |
| No billing prices displayed                    | Check the test key and price IDs belong to the same sandbox, that prices are active fixed monthly/yearly prices, and restart after editing `.env`.                                                                                        |
| Webhook 400                                    | Compare the listener signing secret and the app's `.env`; use the raw payload and correct local origin.                                                                                                                                   |
| Webhook 500                                    | Retry after fixing the provider/database problem; failed events are not marked processed.                                                                                                                                                 |
| Paid but still awaiting confirmation           | Keep the listener running. The return page retries briefly; use Refresh billing status and inspect Stripe's payment/subscription state. Never pay again merely to refresh access.                                                         |
| Existing subscriber cannot see upgrade pricing | Management/refresh and last verified status remain available while pricing is unavailable. Errors are retryable; access still expires at its verified deadline.                                                                           |
| Formatting warnings on Windows                 | Source text uses LF through .gitattributes and Prettier. Save with LF; avoid converting files back to CRLF.                                                                                                                               |
| Windows npm EPERM on a `.node` file            | Stop this project's running dev server before reinstalling locked native dependencies.                                                                                                                                                    |

Existing subscriptions must keep their configured IDs allowlisted. Do not replace
price IDs to simulate an upgrade: removing an active price from the server's
allowlist can remove its entitlement at the next reconciliation.
