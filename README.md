# FitnessCoach

A web app that turns a short quiz into a gym plan the user can trust, with an AI coach that explains each exercise and answers questions when a movement feels wrong.

Team project for ECE1724 Advanced Web Development, University of Toronto, Fall 2026.

**Status:** proposal drafting; tooling merged; schema and coach logic on feature branches. Proposal due **Sunday 8 November**, section drafts by Sunday 1 November. Architecture and plan in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/PLAN.md](docs/PLAN.md); research behind the choices in [docs/RESEARCH.md](docs/RESEARCH.md); meeting notes in [docs/meetings/](docs/meetings/).

## Who does what

| Area                                                               | Owner                  | Issue |
| ------------------------------------------------------------------ | ---------------------- | ----- |
| Proposal 1, Motivation (about 350 words)                           | Mohammad               | #3    |
| Proposal 2, Objectives, architecture, features (about 900 words)   | Nabeegh                | #4    |
| Proposal 3, Plan and responsibilities (about 300 words)            | Shubham, with everyone | #5    |
| Proposal 4, Initial reasoning and AI exploration (about 300 words) | Farnaz                 | #6    |
| Foundation: schema, seed, CI                                       | Nabeegh                | #2    |
| AI coach, including running plans                                  | Nabeegh                | #11   |
| Quiz, body map, today's session                                    | Mohammad               | #15   |
| Progress and photos (cloud upload and download)                    | Farnaz                 | #16   |
| Accounts: sign-in, tiers, Stripe test mode                         | Shubham                | #14   |

The proposal is one Markdown file, 2,000 words at most; each owner commits their own section, and every member submits the same file on Quercus (#13).

**Demo path:** sign-in, quiz, plan, logged workout, coach. Everything else adds to it and must not break it. Core path working end to end by Sunday 15 November; demo-feature freeze Monday 23 November.

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
| Files    | Private S3-compatible bucket; provider chosen in #16                               |
| Auth     | Better Auth                                                                        |
| AI       | Groq first, Gemini as fallback (D4); both tested on the same profiles (#7)         |
| Payments | Stripe in test mode                                                                |

## Repository layout

```
src/app/          pages and route handlers
src/components/   UI components
src/lib/          auth, database client, AI client, storage client
prisma/           schema and migrations
docs/             architecture, plan, research, meetings
```

Lands with the skeleton; until then only `docs/` exists.

## Local Development

Prerequisites: Node.js, npm, and Docker Desktop with Docker Compose available.
Start Docker Desktop before running the Docker commands. When using WSL, enable
Docker Desktop integration for your distribution.

Install dependencies and copy the environment template:

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
npm run db:migrate
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

## Deploy

The hosted preview runs on Vercel (Hobby) with PostgreSQL on Neon (Free); why is
decision D15 in `docs/ARCHITECTURE.md`. `vercel.json` sets the build command to
`scripts/vercel-build.ts`: production deployments run `prisma migrate deploy`, then
`next build`; pull request previews only build. Previews use their own Neon branch, so
a pull request never reads or changes the production database.

One-time setup:

1. Create a Neon account at neon.com and a project named `fitnesscoach` in **AWS US
   East (N. Virginia)**, the region Vercel runs functions in by default (`iad1`). From
   **Connect**, copy two connection strings for the `main` branch: the pooled one (host
   contains `-pooler`) and the direct one (connection pooling turned off). Append
   `?connect_timeout=15` to the direct string (or `&connect_timeout=15` if it already
   has a `?`), so the Prisma CLI waits for a suspended database to wake instead of
   failing with P1001.
2. Apply the migrations and seed the `main` branch from your machine, using the direct
   string:

   ```bash
   DATABASE_URL="<direct string>" npx prisma migrate deploy
   DATABASE_URL="<direct string>" npx prisma db seed
   ```

   In PowerShell, set it first with `$env:DATABASE_URL="<direct string>"`, run both
   commands, then `Remove-Item Env:DATABASE_URL`.

3. In Neon, create a branch named `preview` from `main`; it starts with the same schema
   and seed data. Copy its pooled and direct strings the same way, with
   `connect_timeout=15` on the direct one.
4. Create a Vercel account at vercel.com (Hobby), choose **Add New > Project** and
   import `harunm1/FitnessCoach`. If GitHub asks the repository owner to approve the
   Vercel app, Mohammad approves it. Keep the detected Next.js preset; `vercel.json`
   supplies the build command. The Vercel project belongs to Nabeegh's Hobby account;
   keep the repository public, because Vercel's Hobby commit-author check applies to
   private repositories, so teammates' commits to the public repository still deploy.
5. Before the first deploy, add these under **Settings > Environment Variables**:

   | Name                    | Environment         | Value                        |
   | ----------------------- | ------------------- | ---------------------------- |
   | `DATABASE_URL`          | Production          | Neon `main` pooled string    |
   | `DATABASE_URL_UNPOOLED` | Production          | Neon `main` direct string    |
   | `DATABASE_URL`          | Preview             | Neon `preview` pooled string |
   | `DATABASE_URL_UNPOOLED` | Preview             | Neon `preview` direct string |
   | `COACH_PROVIDER`        | Production, Preview | `groq`                       |
   | `GROQ_API_KEY`          | Production, Preview | from console.groq.com        |
   | `GEMINI_API_KEY`        | Production, Preview | from aistudio.google.com     |

6. Deploy. Each push to `main` redeploys production and applies any new migration to
   the Neon `main` branch; each pull request gets its own preview URL against the
   `preview` branch.

After a schema change merges, the next production deployment migrates `main`. Migrations
run before the new build goes live, so the running version briefly meets the new schema:
keep migrations additive (new tables and nullable columns), and drop or rename in a later
change. To bring `preview` up to date, run step 2's `migrate deploy` with its direct
string, or reset the branch from `main` in Neon. Seed again only when the seed itself
changes; it upserts, so re-running is safe.

## How we work

- Tasks live on the [project board](https://github.com/users/nabeegh-khan/projects/3): Backlog, Ready, In progress, In review, Done.

- One Issue per task, assigned to whoever takes it.
- Code: one short branch per Issue, named `name/issue-topic` (`farnaz/16-progress`), a pull request with `Closes #<n>`, one teammate review, squash and merge. Merge `main` into your branch every few days.
- Reviews: a request gives three days. With no review by then, the author says so in a dated comment on the pull request and squash-merges (D14 in `docs/ARCHITECTURE.md`).
- Documentation (`docs/`, README, meeting notes) goes straight to `main`, no pull request.
- Commits: `<type>(<scope>): <summary>`, imperative, under 50 characters (`feat`, `fix`, `docs`, `chore`, `ci`).
- Everyone commits their own work; the course reads contribution from the Git history.
- Short meeting notes in `docs/meetings/`: decisions and next steps only. Decisions also go in the decisions table in `docs/ARCHITECTURE.md`. AI use logged in `ai-session.md`.
