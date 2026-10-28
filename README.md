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
| Accounts: sign-in, tiers, Stripe test mode                         | open                   | #14   |

The proposal is one Markdown file, 2,000 words at most; each owner commits their own section, and every member submits the same file on Quercus (#13).

**Demo path:** sign-in, quiz, plan, logged workout, coach. Everything else adds to it and must not break it. Core path working end to end by Saturday 14 November; feature freeze 26 November.

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
| AI       | Groq first, Gemini as fallback (D4); both tried on the same profiles (#7)          |
| Payments | Stripe in test mode                                                                |

## Repository layout

```
src/app/          pages and route handlers
src/components/   UI components
src/lib/          auth, database client, AI client, storage client
prisma/           schema and migrations
docs/             architecture, plan, research, meetings
```

## How we work

- Tasks live on the [project board](https://github.com/users/nabeegh-khan/projects/3): Backlog, Ready, In progress, In review, Done.

- One Issue per task, assigned to whoever takes it.
- Code: one short branch per Issue, named `name/issue-topic` (`farnaz/16-progress`), a pull request with `Closes #<n>`, one teammate review, squash and merge. Merge `main` into your branch every few days.
- Documentation (`docs/`, README, meeting notes) goes straight to `main`, no pull request.
- Commits: `<type>(<scope>): <summary>`, imperative, under 50 characters (`feat`, `fix`, `docs`, `chore`, `ci`).
- Everyone commits their own work; the course reads contribution from the Git history.
- Short meeting notes in `docs/meetings/`: decisions and next steps only. Decisions also go in the decisions table in `docs/ARCHITECTURE.md`. AI use logged in `ai-session.md`.
