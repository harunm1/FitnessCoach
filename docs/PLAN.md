# Plan (draft)

During team formation, we shared backgrounds and preferences and divided work around our strengths.

## Dates

| Window          | Goal                                                 | Course deadline                            |
| --------------- | ---------------------------------------------------- | ------------------------------------------ |
| 21 to 25 Oct    | architecture, plan and skeleton                      | team formation on Quercus, Sun 25 Oct      |
| 26 Oct to 8 Nov | proposal written; schema, sign-in and CI in place    | **proposal, Sun 8 Nov (15%)**              |
| 9 to 18 Nov     | core path by 15 Nov; integrate and use the app       | team health check, Wed 18 Nov              |
| 19 to 23 Nov    | integrate demo features; freeze demo scope on 23 Nov |                                            |
| 24 to 26 Nov    | slides, rehearsals and testing the live demo         | introduction Wed 25 Nov; slides Thu 26 Nov |
| 27 Nov to 6 Dec | development, polishing, report and video             | **final report, Sun 6 Dec (35%)**          |

## Proposal sections

| Section                                 | Weight | Owner         |
| --------------------------------------- | ------ | ------------- |
| 1. Motivation                           | 20%    | Mohammad (#3) |
| 2. Objectives, architecture, features   | 50%    | Nabeegh       |
| 3. Plan and responsibilities            | 15%    | Shubham (#5)  |
| 4. Initial reasoning and AI exploration | 15%    | Farnaz (#6)   |

## Build areas

| Area                     | What it covers                                     | Owner    |
| ------------------------ | -------------------------------------------------- | -------- |
| Foundation               | schema, seed and CI                                | Nabeegh  |
| AI coach                 | AI coach, including running plans                  | Nabeegh  |
| Accounts                 | authentication and access tiers                    | Shubham  |
| Quiz and workout session | quiz, body map and session screens                 | Mohammad |
| Progress                 | workout history, progress photos and cloud storage | Farnaz   |

Core path: sign in → quiz → workout plan → logged workout → one coach exchange, by 15 November.

### Due Sun 15 Nov (checkpoint 1)

The course's core technical requirements are mandatory for every project ([project handout](https://www.eecg.utoronto.ca/~cying/courses/ece1724-web/project/handout/)). By 15 Nov each one is either done on `main` or has an open PR that works end to end.

| Course requirement                                   | How we meet it                                                                                                     | Owner               | State, 8 Nov                 | Issue or PR        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------- | ---------------------------- | ------------------ |
| Frontend: TypeScript, Next.js, Tailwind CSS          | Next.js 16 App Router, Tailwind 4                                                                                  | everyone            | done                         | #1                 |
| Frontend: shadcn/ui or similar                       | shadcn/ui set up once, used by every screen                                                                        | Nabeegh             | not started                  | #75                |
| Frontend: responsive design                          | every screen usable on a phone at the gym                                                                          | each screen's owner | to check per screen          | #15, #16, #63      |
| Data: TypeScript server code, PostgreSQL             | Prisma 7 on PostgreSQL                                                                                             | Nabeegh             | done                         | #2, #44            |
| Data: cloud storage linked to users or records       | progress photos upload to and download from a private Cloudflare R2 bucket, key stored with the user's record (D3) | Farnaz              | not started                  | #16                |
| Architecture A: Next.js full stack                   | Server Components read, Server Actions write (the auth Route Handler arrives with #67)                             | everyone            | done                         | ARCHITECTURE.md    |
| Advanced feature 1: authentication and authorization | Better Auth sign-in, access tiers                                                                                  | Shubham             | in review                    | #67, #50           |
| Advanced feature 2: external API (cloud AI)          | the coach: plans and chat through Groq with Gemini fallback, checked in code                                       | Nabeegh             | plans merged; chat in review | #11, #48, #53, #63 |
| Loading and error states (proposal section 2)        | `loading.tsx` and `error.tsx` per route                                                                            | each route's owner  | root in review               | #74, #15           |

**Core path working end to end by 15 Nov** (agreed at meeting 3): sign in (#67) → quiz (#39) → workout plan (#39, #73) → logged workout (#39) → one coach exchange (#63), with a progress photo stored in R2 (#16).

**Status, 6 November:** the proposal is final on `main`. Schema and CI are in place; running and hybrid weeks, saving the active plan, coach-call records and the CI coach replay merged today. Sign-in, due by 8 November, will miss that date: it is in review (#67, review due Monday 9 November) and lands after that review, ahead of the 15 November core path. Coach chat and its safety checks stay in review until their safety screen passes an independent review.

Running is built alongside lifting.

## Integration

- The shared Prisma schema and workout-plan JSON are agreed first; quiz, sessions and progress depend on schema and authentication.
- Every Tuesday at 7 p.m., each member reports what they built, blockers and next steps. Questions, decisions and blockers stay on the related GitHub issue; Discord handles scheduling.
- Team brainstorming settles design, informed by [RESEARCH.md](RESEARCH.md) and [COACH_EVAL.md](https://github.com/harunm1/FitnessCoach/blob/main/docs/COACH_EVAL.md).
- One issue per task, one branch per issue, one feature or fix per PR with `Closes #n`, so review fits in one sitting. Code PRs need one teammate approval. Documentation, proposal sections included, merges without review when there are no conflicts (meeting 3, 3 Nov): edits are committed directly, one commit per change naming the section owner, with one short note. Code reviewers get three days; after that the author notes it on the PR and squash-merges. `main` is protected: ruleset 26246501 requires a pull request, one approval and the CI `check`, so a direct push or a merge without approval needs the ruleset's bypass.
- Branches merge weekly so the app runs together. Send no teammate more than three small, separate PRs daily. Squash and merge by default; use a merge commit for branches with multiple authors so their commits retain attribution.
- CI runs formatting, lint, TypeScript checks, tests and build. We use the app ourselves as each piece lands.
- Checkpoints: 15 Nov (core path), 21 Nov (integration review), 23 Nov (demo-feature freeze), 24–26 Nov (slides, rehearsals and live-demo tests). Development and polishing continue to the 6 Dec final report.

## Risks

| Risk                  | Mitigation                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| LLM limits/outage     | Groq retries, then Gemini; if both fail, rule-based plan and cached coach reply; recording as last resort |
| Feature-area delays   | retain one stable core demo                                                                               |
| Migration conflicts   | discuss schema changes before merging                                                                     |
| Integration conflicts | merge weekly; use the app as each piece lands                                                             |
| Cloud storage setup   | use photo features as they land to catch setup issues early                                               |
