# FitnessCoach

A web app that turns a short quiz into a weekly gym, running or hybrid plan the user can trust, with an AI coach that explains each exercise and answers questions about the user's own plan.

Team project for ECE1724 Advanced Web Development, University of Toronto, Fall 2026.

**Status (8 November):** proposal final on `main` (#13). On `main`: the Next.js skeleton, the Prisma schema for strength and running with its migrations, the seeded exercise library, CI with a replay of recorded coach replies, the coach's plan generation with the verifier and Groq-to-Gemini fallback, rule-based running and hybrid weeks, saving a week as the active plan, coach-call records (not yet stored), the session screen (#39), and sign-in, access tiers and Stripe test mode (#67, #68). In open pull requests: coach chat (#53), guardrails (#48), streamed replies (#56), the deployed preview (#61), the body map (#70), the strength-only starter plan (#73), root loading and error states (#74), the shadcn/ui components (#77), the query indexes (#78), integration tests against PostgreSQL in CI (#81, draft) and the progress streak and muscle logic (#82). Core path working end to end by Sunday 15 November; demo-feature freeze Monday 23 November.

Architecture and decisions: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Plan and dates: [docs/PLAN.md](docs/PLAN.md). Research behind the choices: [docs/RESEARCH.md](docs/RESEARCH.md). Coach evaluation, Groq against Gemini: [docs/COACH_EVAL.md](docs/COACH_EVAL.md). Meeting notes: [docs/meetings/](docs/meetings/). Design reviews: [docs/design-reviews/](docs/design-reviews/). Paper notes, one per paper we cite: [docs/papers/](docs/papers/README.md).

## Who does what

| Area                                               | Owner    | Issue |
| -------------------------------------------------- | -------- | ----- |
| Foundation: schema, seed, CI (done)                | Nabeegh  | #2    |
| AI coach, including running plans                  | Nabeegh  | #11   |
| Quiz, body map, today's session                    | Mohammad | #15   |
| Progress and photos (cloud upload and download)    | Farnaz   | #16   |
| Accounts: sign-in, access tiers, Stripe test mode  | Shubham  | #14   |
| Proposal (one Markdown file, every member submits) | Everyone | #13   |

**Demo path:** sign-in, quiz, plan, logged workout, one coach exchange. Everything else adds to it and must not break it. Stripe test mode is a stretch off the demo path, shown if ready by the freeze.

**Scope:** lifting, strength training and running. The coach gives no nutrition advice (diet, calories, supplements or meals); a nutrition question gets a short out-of-scope reply that points to a registered dietitian (8 November [design review](docs/design-reviews/2026-11-08-review.md), decision 5; the reply lands with #43).

## Team

| Name              | Student number | Email                              | GitHub                                                 |
| ----------------- | -------------- | ---------------------------------- | ------------------------------------------------------ |
| Mohammad Harun    | 1005235844     | mohammad.harun@mail.utoronto.ca    | [@harunm1](https://github.com/harunm1)                 |
| Farnaz Moayyedian | 1003849954     | farnaz.moayyedian@mail.utoronto.ca | [@farnazmn](https://github.com/farnazmn)               |
| Shubham Panchal   | 1012431067     | s.panchal@mail.utoronto.ca         | [@shubham2110-lab](https://github.com/shubham2110-lab) |
| Nabeegh Khan      | 1001388152     | nabeegh.khan@mail.utoronto.ca      | [@nabeegh-khan](https://github.com/nabeegh-khan)       |

## Stack

| Layer    | Choice                                                                             |
| -------- | ---------------------------------------------------------------------------------- |
| App      | Next.js App Router, TypeScript (Server Components, Server Actions, route handlers) |
| UI       | Tailwind CSS, shadcn/ui, mobile-first                                              |
| Data     | PostgreSQL with Prisma                                                             |
| Files    | Private S3-compatible bucket (D3, #16)                                             |
| Auth     | Better Auth                                                                        |
| AI       | Groq first, Gemini as fallback, rule-based plan if both fail (D4, D6)              |
| Payments | Stripe in test mode, a stretch off the demo path (#14)                             |

## Repository layout

```
src/app/          pages; Server Actions and route handlers as they land
src/lib/coach/    plan generation, verifier, rule-based fallback; providers.ts is the only module that calls a model API
src/lib/          database client, auth and storage clients as they land
prisma/           schema, migrations and seed
docs/             architecture, plan, research, coach evaluation, meetings, proposal section drafts
ece1724_group18_project_proposal.md   final proposal (submitted on Quercus)
```

## Local Development

Start with the [complete local setup guide](docs/LOCAL_DEVELOPMENT.md) for Node 22,
PostgreSQL, authentication secrets, Mailpit, Stripe and the separate terminals.
The [acceptance checklist](docs/ACCOUNTS_TESTING.md) documents expected results for
all three accounts milestones. The commands below are a database/app overview;
configure authentication and mail before testing signup.

Prerequisites: Node.js 22.13 or newer, npm, and Docker Desktop with Docker Compose available.
Start Docker Desktop before running the Docker commands. When using WSL, enable
Docker Desktop integration for your distribution.

Install dependencies and copy the environment template **only for a fresh setup**
(preserve an existing `.env`):

```bash
npm install
cp .env.example .env
```

In PowerShell, use this equivalent copy command:

```powershell
Copy-Item .env.example .env
```

Docker runs PostgreSQL only; run the Next.js application locally with npm.
PostgreSQL uses host `localhost`, port `5432`, database `fitnesscoach`, username
`fitnesscoach`, and password `fitnesscoach`. The expected `DATABASE_URL` is:

```dotenv
DATABASE_URL="postgresql://fitnesscoach:fitnesscoach@localhost:5432/fitnesscoach?schema=public"
```

Start PostgreSQL and check its status:

```bash
docker compose up -d
docker compose ps
```

Wait until the `postgres` service reports `healthy`, then apply migrations, seed
the exercise dataset and demo user, and start the application:

```bash
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Stop PostgreSQL while keeping its data in the named volume:

```bash
docker compose down
```

To reset the local database, remove the containers and named volume. This deletes
all local PostgreSQL data; run migrations and seeding again after starting it:

```bash
docker compose down -v
```

### Accounts and access tiers

For signup, email verification, login, password recovery and account setup, see
[the accounts guide](docs/ACCOUNTS.md). Add the Better Auth and SMTP values from
`.env.example` to your existing `.env`, generate your own secret, and apply the
new migration before using `/sign-up`. On `/account`, eligible users can start a
one-time seven-day trial without a card. The guide explains server-side access
checks, admin setup, and isolated database and browser tests. For Milestone 3
Stripe test-mode Checkout, the billing portal and webhook setup, follow
[the billing guide](docs/BILLING.md). Stripe settings are optional for free/trial
access.

### Coach keys

The coach reads its keys from `.env` (never committed). `COACH_PROVIDER` picks the provider that goes first (`groq` by default), and its key is required. If the other provider's key is also set, it becomes the fallback. `GROQ_MODEL` and `GEMINI_MODEL` override the default models.

```dotenv
COACH_PROVIDER="groq"
GROQ_API_KEY=""     # console.groq.com/keys
GEMINI_API_KEY=""   # aistudio.google.com/apikey
```

### Checks

Tests come in three layers (8 November design review, decision 4): unit tests for pure logic, with saved model replies instead of live calls; API mocking at the provider boundary, so timeouts, invalid JSON and rate limits are tested on purpose; and integration tests against a real PostgreSQL 16 that CI has run on every pull request since #67 (accounts, trials and billing); the ones for the quiz and session Server Actions are #79 (PR #81, open). Each owner tests their own slice.

The same checks CI runs on every pull request:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

## Deploy

The hosted preview runs on Vercel (Hobby) with PostgreSQL on Neon (Free); why is
decision D15 in `docs/ARCHITECTURE.md`. `vercel.json` sets the build command to
`scripts/vercel-build.ts`. On production and preview deployments it first checks that
`DATABASE_URL` and `DATABASE_URL_UNPOOLED` are both set and point at the same Neon
branch, then runs `prisma migrate deploy` and `next build`; elsewhere it only builds.
Production uses the Neon `main` branch and pull request previews use a separate
`preview` branch, so a pull request never reads or changes the production database.

Who does what: Nabeegh sets up Neon (steps 1 to 3). Mohammad creates the Vercel project
(steps 4 to 7): Vercel lets only the owner of a personal-account repository import it,
so a collaborator cannot. The project belongs to Mohammad's Hobby account. The
repository stays public; Vercel's Hobby limits on commit authors apply to private
repositories.

One-time setup:

1. Create a Neon account at neon.com and a project named `fitnesscoach` in **AWS US
   East (N. Virginia)**, next to Vercel's default function region (`iad1`); the region
   cannot be changed after the project is created. From **Connect**, copy two
   connection strings for the `main` branch: the pooled one (host contains `-pooler`)
   and the direct one (connection pooling turned off). Append `connect_timeout=15` to
   the direct string (after `&` if it already has a `?`, otherwise after `?`), so the
   Prisma CLI waits for a suspended database to wake instead of failing with P1001.
2. Apply the migrations and seed the `main` branch from your machine. On your machine
   the Prisma CLI and the seed both read `DATABASE_URL` (the direct string is used
   only on Vercel), so set that one variable to the direct string:

   ```bash
   export DATABASE_URL="<direct string>"
   npx prisma migrate deploy
   npx prisma db seed
   unset DATABASE_URL
   ```

   In PowerShell: `$env:DATABASE_URL="<direct string>"`, the two `npx` commands, then
   `Remove-Item Env:DATABASE_URL`.

3. In Neon, create a branch named `seed` from `main` now, while `main` holds only the
   seed, and connect nothing to it. Then create a branch named `preview` from `seed`, not
   from `main`: a branch copies its parent's data, and previews must never hold real
   users' accounts. Copy the `preview` pooled and direct strings the same way, with
   `connect_timeout=15` on the direct one. Send all four strings to Mohammad privately,
   not in the repository or the team chat.
4. Mohammad creates a Vercel account at vercel.com (Hobby) with his GitHub login,
   chooses **Add New > Project**, names the project and imports `harunm1/FitnessCoach`.
   Keep the detected Next.js preset; `vercel.json` supplies the build command. Read the
   production domain from **Settings > Domains** (usually `<project>.vercel.app`).
5. Add these under **Settings > Environment Variables**, each scoped as listed:

   | Name                                      | Environment         | Value                                                                                               |
   | ----------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------- |
   | `DATABASE_URL`                            | Production          | Neon `main` pooled string                                                                           |
   | `DATABASE_URL_UNPOOLED`                   | Production          | Neon `main` direct string                                                                           |
   | `DATABASE_URL`                            | Preview             | Neon `preview` pooled string                                                                        |
   | `DATABASE_URL_UNPOOLED`                   | Preview             | Neon `preview` direct string                                                                        |
   | `BETTER_AUTH_SECRET`                      | Production          | a random secret of 32 or more characters (the `node -e` line in `.env.example`)                     |
   | `BETTER_AUTH_URL`                         | Production          | the production origin, `https://<project>.vercel.app`, with no path                                 |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`   | Production          | a hosted SMTP service with a verified sender; port 465 with `SMTP_SECURE=true`, or 587 with `false` |
   | `SMTP_FROM`, `SMTP_USER`, `SMTP_PASSWORD` | Production          | the verified sender address, and the service's login (user and password set together)               |
   | `COACH_PROVIDER`                          | Production, Preview | `groq`                                                                                              |
   | `GROQ_API_KEY`                            | Production, Preview | from console.groq.com                                                                               |
   | `GEMINI_API_KEY`                          | Production, Preview | from aistudio.google.com                                                                            |

   Sign-up needs a working email: the app requires a verified address, and Mailpit
   (the local mail catcher) does not exist on Vercel, which also blocks outbound port 25. Stripe stays unset unless billing is configured as in `docs/BILLING.md`.

6. Deploy. Each push to `main` redeploys production and applies any new migration to
   the Neon `main` branch; each pull request gets its own preview URL and applies its
   migrations to the `preview` branch first. A build stops before any step, with the
   variable named, if a database URL is missing or the two point at different branches.
7. Deployment Protection: new Vercel projects protect preview URLs with a Vercel login,
   and a Hobby account can share them with only one outside user. Previews are for
   checking the build and the migrations: auth is not configured on them
   (`BETTER_AUTH_URL` and `BETTER_AUTH_SECRET` are Production only), so pages that need
   a session show the error page there. Sign-in works on production only; use the
   production URL for the demo and the pilot.

Migrations run before the new build goes live, so the running version briefly meets
the new schema: keep migrations additive (new tables and nullable columns), and drop or
rename in a later change. The `preview` branch is shared by every open pull request; if
two of them add migrations that conflict, or a pull request closes without merging,
use **Reset from parent** on `preview` in Neon. Its parent is `seed`, so the reset
returns it to the seed-only state and never copies real users from `main`; the next
preview build applies the migrations again. Never connect anything to `seed`. (Neon
Free keeps only a few hours of history, so a restore point is not a substitute for the
`seed` branch.) Seed again only when the seed itself changes; it upserts, so
re-running is safe.

If `prisma migrate deploy` fails partway through a migration, Prisma records the
failure and refuses later deploys until it is resolved. Either undo whatever part of
the migration did apply and run `npx prisma migrate resolve --rolled-back
<migration_name>`, or finish the migration by hand and run `--applied` instead; run
either with `DATABASE_URL` set to that branch's direct string, then redeploy.

## How we work

- Tasks live on the [project board](https://github.com/users/nabeegh-khan/projects/3): Backlog, Ready, In progress, In review, Done.

- One Issue per task, assigned to whoever takes it.
- Code: one short branch per Issue, named `name/issue-topic` (`farnaz/16-progress`), a pull request with `Closes #<n>`, one teammate review, squash and merge. Merge `main` into your branch every few days.
- Reviews: a request gives three days. With no review by then, the author says so in a dated comment on the pull request and squash-merges (D14 in `docs/ARCHITECTURE.md`).
- Documentation (`docs/`, README, meeting notes) goes straight to `main`, no pull request.
- Commits: `<type>(<scope>): <summary>`, imperative, under 50 characters (`feat`, `fix`, `docs`, `chore`, `ci`).
- Everyone commits their own work; the course reads contribution from the Git history.
- Short meeting notes in `docs/meetings/`: decisions and next steps only. Decisions also go in the decisions table in `docs/ARCHITECTURE.md`. AI use logged in `ai-session.md`.
