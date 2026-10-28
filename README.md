# FitnessCoach

A web app that turns a short quiz into a gym plan the user can trust, with an AI coach that explains each exercise and answers questions when a movement feels wrong.

Team project for ECE1724 Advanced Web Development, University of Toronto, Fall 2026.

**Status:** idea agreed 12 October; proposal drafting; architecture and plan drafts in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/PLAN.md](docs/PLAN.md); research behind the choices in [docs/RESEARCH.md](docs/RESEARCH.md). Proposal due Sunday 8 November.

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
| Files    | DigitalOcean Spaces, private bucket                                                |
| Auth     | Better Auth                                                                        |
| AI       | Gemini API, Groq as fallback                                                       |
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

## How we work

- Tasks live on the [project board](https://github.com/users/nabeegh-khan/projects/3): Backlog, Ready, In progress, In review, Done.

- One Issue per task, assigned to whoever takes it.
- Code: one branch per Issue (`feature/`, `fix/`), a pull request with `Closes #<n>`, one teammate review, squash and merge.
- Documentation goes straight to `main`.
- Commits: `<type>(<scope>): <summary>`, imperative, under 50 characters (`feat`, `fix`, `docs`, `chore`, `ci`).
- Everyone commits their own work; the course reads contribution from the Git history.
- Short meeting notes in `docs/meetings/`: decisions and next steps only. Decisions also go in the decisions table in `docs/ARCHITECTURE.md`. AI use logged in `ai-session.md`.
