# FitnessCoach

A web app that turns a short quiz into a weekly gym, running or hybrid plan the user can trust, with an AI coach that explains each exercise and answers questions about the user's own plan.

Team project for ECE1724 Advanced Web Development, University of Toronto, Fall 2026.

## Status

As of 10 November 2026, checked against `main`, the open pull requests and the project board.

**Merged on main.** The proposal (#13). The Next.js skeleton, the Prisma schema for strength and running, the seeded exercise library and CI, which replays recorded coach replies. The coach's plan generation with the verifier, Groq-to-Gemini fallback, rule-based running and hybrid weeks, saving a week as the active plan, per-call logging in code (the table that stores it, #52, is not built), and guardrails for pain, diagnosis and off-topic requests (#48). Sign-in, access tiers and Stripe test mode (#67, #68), and the session screen, body map and signed-in quiz and sessions (#39, #70, #83).

**In review (open pull requests).** Coach chat (#53), streamed replies (#56), the deployed preview (#61), the strength-only starter plan (#73), root loading and error states (#74), shadcn/ui (#77), query indexes (#78), integration tests for the core path (#81), guardrail false positives (#100), the progress streak and muscle logic (#82), the eval repeat runner (#87), the "Why this plan" panel (#88), quiz run days (#97), model-call record fields (#98) and demo mode with cached coach plans (#99). Drafts: schema constraints (#89) and the coach chat screen (#96).

**Next (board columns Ready and In progress).** Ready: the curated exercise library (#8), logging and chat that survive a dropped connection (#42), the coach-call table (#52), "Personalize with the coach" (#58) and the body-map follow-up questions (#60). In progress: progress and photos (#16), the hybrid week (#46), the per-user coach limit (#51), the chat screen (#63), an RPE target per exercise (#65), integration tests for the core path (#79) and quiz run days (#85). Core path working end to end by Sunday 15 November; demo-feature freeze Monday 23 November; final report Sunday 6 December.

Architecture and decisions: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Plan and dates: [docs/PLAN.md](docs/PLAN.md). Research behind the choices: [docs/RESEARCH.md](docs/RESEARCH.md). Coach evaluation, Groq against Gemini: [docs/COACH_EVAL.md](docs/COACH_EVAL.md). Meeting notes: [docs/meetings/](docs/meetings/). Design reviews: [docs/design-reviews/](docs/design-reviews/). Paper notes, one per paper we cite: [docs/papers/](docs/papers/README.md).

## Who does what

| Area                                                     | Owner    | Issue |
| -------------------------------------------------------- | -------- | ----- |
| Foundation: schema, seed, CI (done)                      | Nabeegh  | #2    |
| AI coach, including running plans                        | Nabeegh  | #11   |
| Quiz, body map, today's session (done)                   | Mohammad | #15   |
| Exercise library (curated, with cues)                    | Mohammad | #8    |
| Progress and photos (cloud upload and download)          | Farnaz   | #16   |
| Accounts: sign-in, access tiers, Stripe test mode (done) | Shubham  | #14   |
| Proposal (one Markdown file, every member submits)       | Everyone | #13   |

**Demo path:** sign-in, quiz, plan, logged workout, one coach exchange. Everything else adds to it and must not break it. Stripe test mode is on `main` (#68) but off the demo path.

**Scope:** lifting, strength training and running. The coach gives no nutrition advice (diet, calories, supplements or meals); a nutrition question gets a short out-of-scope reply that points to a registered dietitian (8 November [design review](docs/design-reviews/2026-11-08-review.md), decision 5; the reply is in code on `main`, #48).

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
src/app/          pages, Server Actions and route handlers (account, onboarding, session, auth pages, api/auth, api/stripe)
src/components/   shared components (quiz form, body map, set logging, rest timer, coach chat)
src/lib/coach/    plan generation, verifier, rule-based fallback, guardrails; providers.ts is the only module that calls a coach model API, apart from the safety model check, which holds its own URL and is not called on main yet (D15)
src/lib/          database client, auth, billing, body map, onboarding and workout logic
prisma/           schema, migrations and seed
tests/            integration (PostgreSQL) and browser (Playwright) tests
eval/             coach evaluation runner and recorded results
scripts/          admin and test-database helpers
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

For a database used with an older accounts branch, complete the
[auth migration history update](docs/ACCOUNTS.md#migration-name-update) before
deploying migrations. This avoids trying to recreate existing auth tables.

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

The [signed-in quiz/session guide](docs/QUIZ_SESSION_AUTH.md) covers user-owned
plans and logs, plus optional local demo logins for all four tiers.

### Coach keys

The coach reads its keys from `.env` (never committed). `COACH_PROVIDER` picks the provider that goes first (`groq` by default), and its key is required. If the other provider's key is also set, it becomes the fallback. `GROQ_MODEL` and `GEMINI_MODEL` override the default models.

```dotenv
COACH_PROVIDER="groq"
GROQ_API_KEY=""     # console.groq.com/keys
GEMINI_API_KEY=""   # aistudio.google.com/apikey
```

### Checks

Tests come in three layers (8 November design review, decision 4): unit tests for pure logic, with saved model replies instead of live calls; API mocking at the provider boundary, so timeouts, invalid JSON and rate limits are tested on purpose; and integration tests against a real PostgreSQL 16 that CI has run on every pull request since #67 (accounts, trials and billing), including authentication and the quiz and session Server Actions (#83; more in #79, PR #81). Each owner tests their own slice.

The same checks CI runs on every pull request, in this order (CI first applies the migrations to a PostgreSQL 16 service with `npm run db:migrate:test`; locally, set `TEST_DATABASE_URL` and run it before the integration tests):

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npm run test:e2e
```

## How we work

- Tasks live on the [project board](https://github.com/users/nabeegh-khan/projects/3): Backlog, Ready, In progress, In review, Done.

- One Issue per task, assigned to whoever takes it.
- Code: one short branch per Issue, named `name/issue-topic` (`farnaz/16-progress`), a pull request with `Closes #<n>`, one teammate review, squash and merge. Merge `main` into your branch every few days.
- Reviews: a request gives three days. With no review by then, the author says so in a dated comment on the pull request and squash-merges (D14 in `docs/ARCHITECTURE.md`).
- Documentation (`docs/`, README, meeting notes) goes straight to `main`, no pull request.
- Commits: `<type>(<scope>): <summary>`, imperative, under 50 characters (`feat`, `fix`, `docs`, `chore`, `ci`).
- Everyone commits their own work; the course reads contribution from the Git history.
- Short meeting notes in `docs/meetings/`: decisions and next steps only. Decisions also go in the decisions table in `docs/ARCHITECTURE.md`. AI use logged in `ai-session.md`.
