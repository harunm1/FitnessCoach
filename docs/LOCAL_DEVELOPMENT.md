# Local development: accounts and access tiers

Start here for Milestones 1–2 of Issue #14. [ACCOUNTS.md](ACCOUNTS.md) explains
account behavior and integration contracts; [ACCOUNTS_TESTING.md](ACCOUNTS_TESTING.md)
contains acceptance checks. Billing is reviewed in a separate follow-up PR.

## Prerequisites

- Node.js 22 (22.12 or newer; CI uses Node 22), npm and Git.
- Docker Desktop with Compose. Start Docker Desktop first; enable WSL integration
  if running commands from WSL. Use Windows Node/npm in PowerShell, or Linux
  Node/npm in WSL; do not share native `node_modules` between the two.

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
| `TEST_DATABASE_URL`          | Tests only; must explicitly name a separate database ending `_test`. Never use the development database.                      |

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

Apply existing migration files without generating a new migration:

```powershell
npx prisma migrate deploy
npm run db:seed
```

`npm install` generates the Prisma client through postinstall. If the schema/client
needs refreshing, run `npx prisma generate`. Use `npm run db:migrate` when actually
creating a schema migration; ordinary setup uses the committed migration files.
The seed imports exercises and the demo user. That demo is not a password-login
account; register your own account. Seeding is not needed for each app restart.

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

## 4. Start Next.js — app terminal

```powershell
npm run dev
```

Open http://localhost:3000. If the app chooses another port because 3000 is busy,
stop the duplicate server or deliberately update BETTER_AUTH_URL to match. Restart the app after changing `.env`. One app process
should own the development port.

1. Open `/sign-up`, enter your name/email and a 12–128 character password.
2. Open the verification email in Mailpit and follow its link.
3. Sign in at `/sign-in`; `/account` shows your current server-checked access.
4. Start the free trial only when ready. It lasts seven days without a card.
5. Use Change password on the account page when signed in. Use Forgot password
   on sign-in for email recovery when you cannot authenticate.

See [the acceptance matrix](ACCOUNTS_TESTING.md) for every expected outcome,
including negative cases, trial expiry and tier changes.

## Normal restart and shutdown

For later sessions, start Docker Desktop, PostgreSQL and Mailpit if needed, then
run `npm run dev`. Keep existing secrets and data; dependency installation,
migrations and seed are not daily restart steps.

Stop Next.js or Mailpit with Ctrl+C in their terminals. Stop the
database without deleting data:

```powershell
docker compose down
```

Destructive reset, only when intentionally discarding all local database data:

```powershell
docker compose down -v
```

After a reset, restart PostgreSQL, apply migrations and seed again. Source-code
backups do not back up PostgreSQL. Coordinate migration-aware rollback rather
than resetting a database containing useful data.

## Troubleshooting

| Symptom                                        | Check/action                                                                                                                                                                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing script `db:migrate`                    | Confirm the repository root and intended branch, then `npm run`.                                                                                                                                                                          |
| P1000 credentials failure                      | Confirm DATABASE_URL and `docker compose ps`; check for another PostgreSQL service using port 5432. Existing volumes retain their original credentials even if Compose values change. Preserve data while correcting the connection/role. |
| Port 3000 already used                         | Stop the other FitnessCoach server; avoid running two dev servers.                                                                                                                                                                        |
| Missing auth secret                            | Generate a private value, set BETTER_AUTH_SECRET and restart.                                                                                                                                                                             |
| Verification/reset email absent                | Check Mailpit and SMTP settings. Resend through the UI; unverified users cannot sign in.                                                                                                                                                  |
| Webhook 400                                    | Compare the listener signing secret and the app's `.env`; use the raw payload and correct local origin.                                                                                                                                   |
| Webhook 500                                    | Retry after fixing the provider/database problem; failed events are not marked processed.                                                                                                                                                 |
| Existing subscriber cannot see upgrade pricing | Management/refresh and last verified status remain available while pricing is unavailable. Errors are retryable; access still expires at its verified deadline.                                                                           |
| Formatting warnings on Windows                 | Source text uses LF through .gitattributes and Prettier. Save with LF; avoid converting files back to CRLF.                                                                                                                               |
| Windows npm EPERM on a `.node` file            | Stop this project's running dev server before reinstalling locked native dependencies.                                                                                                                                                    |

Existing subscriptions must keep their configured IDs allowlisted. Do not replace
price IDs to simulate an upgrade: removing an active price from the server's
allowlist can remove its entitlement at the next reconciliation.
