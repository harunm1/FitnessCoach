# Plan (draft)

## Dates

| Window          | Goal                                              | Course deadline                                                             |
| --------------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| 21 to 25 Oct    | architecture, plan and skeleton                   | team formation on Quercus, Sun 25 Oct                                       |
| 26 Oct to 8 Nov | proposal written; schema, sign-in and CI in place | **proposal, Sun 8 Nov (15%)**                                               |
| 9 to 18 Nov     | core path works: quiz, plan, logged workout       | team health check, Wed 18 Nov                                               |
| 19 to 26 Nov    | planned features; work frozen 26 Nov              | introduction Wed 25 Nov; slides Thu 26 Nov                                  |
| 27 Nov to 6 Dec | live demo; README report, `ai-session.md`, video  | **presentation, Fri 27 Nov or Fri 4 Dec (10%)**; **final, Sun 6 Dec (35%)** |

## Proposal sections

| Section                                 | Weight | Owner                                                                          |
| --------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| 1. Motivation                           | 20%    | Mohammad (#3) |
| 2. Objectives, architecture, features   | 50%    | Nabeegh                                                                        |
| 3. Plan and responsibilities            | 15%    | Shubham (#5)                                                      |
| 4. Initial reasoning and AI exploration | 15%    | Farnaz (#6)                                                                    |

## Build areas

| Area | What it covers | Owner |
| --- | --- | --- |
| Foundation | Next.js skeleton, Prettier/ESLint, CI, Prisma schema/seed, exercise dataset | Nabeegh |
| AI coach | workout/running plan generation, verifier, streamed chat, AI/body-map follow-up | Nabeegh |
| Accounts | Better Auth, tiers, Stripe test mode; shared local Docker Compose PostgreSQL (`localhost:5432`, #23), authentication/backend support | Shubham |
| Quiz and workout session | quiz, interactive body map, today's session, Redux Toolkit, workout/running logging | Mohammad |
| Progress | history, streaks, calendar heatmap, photos/cloud storage, workout/running progress | Farnaz |

Demo: sign in → complete quiz → generate workout plan → open workout session → log workout → view progress.
Running is planned; nearby-gym discovery and MCP exercise tools remain optional/stretch.

## Integration

- Agree shared Prisma schema and workout-plan JSON first.
- One GitHub issue/task, branch/issue; PR: `Closes #n`, teammate review, squash merge.
- Integrate frequently. CI: formatting, lint, typecheck, tests, build.
- Checkpoints: Sat 14 Nov (core path), Sat 21 Nov (demo dry run).

## Risks

| Risk | Mitigation |
| --- | --- |
| LLM limits/outage | validate output; fallback |
| Stripe delays | outside demo path |
| Feature-area delays | stable core demo |
| Migration conflicts | discuss schema changes |
| Integration conflicts | integrate regularly |
| Cloud storage setup | verify configuration |
