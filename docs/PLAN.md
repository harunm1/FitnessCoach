# Plan (draft)

During team formation, we shared backgrounds and preferences and divided work around our strengths.

## Dates

| Window          | Goal                                                 | Course deadline                            |
| --------------- | ---------------------------------------------------- | ------------------------------------------ |
| 21 to 25 Oct    | architecture, plan and skeleton                      | team formation on Quercus, Sun 25 Oct      |
| 26 Oct to 8 Nov | proposal written; schema, sign-in and CI in place    | **proposal, Sun 8 Nov (15%)**              |
| 9 to 18 Nov     | core path by 14 Nov; integrate and use the app       | team health check, Wed 18 Nov              |
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

Core path: sign in → quiz → workout plan → logged workout → one coach exchange, by 14 November.
Running is built alongside lifting.

## Integration

- The shared Prisma schema and workout-plan JSON are agreed first; quiz, sessions and progress depend on schema and authentication.
- Every Tuesday at 7 p.m., each member reports what they built, blockers and next steps. Questions, decisions and blockers stay on the related GitHub issue; Discord handles scheduling.
- Team brainstorming settles design, informed by [RESEARCH.md](RESEARCH.md) and [COACH_EVAL.md](https://github.com/harunm1/FitnessCoach/blob/nabeegh/19-coach-eval/docs/COACH_EVAL.md).
- One issue per task, one branch per issue, one feature or fix per PR with `Closes #n`, so review fits in one sitting. Code and proposal PRs need one teammate approval; proposal/documentation PRs request all teammates. Meeting/admin notes may go directly to unprotected `main`.
- Branches merge weekly so the app runs together. Send no teammate more than three small, separate PRs daily. Squash and merge by default; use a merge commit for branches with multiple authors so their commits retain attribution.
- CI runs formatting, lint, TypeScript checks, tests and build. We use the app ourselves as each piece lands.
- Checkpoints: 14 Nov (core path), 21 Nov (integration review), 23 Nov (demo-feature freeze), 24–26 Nov (slides, rehearsals and live-demo tests). Development and polishing continue to the 6 Dec final report.

## Risks

| Risk                  | Mitigation                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| LLM limits/outage     | Groq retries, then Gemini; if both fail, rule-based plan and cached coach reply; recording as last resort |
| Feature-area delays   | retain one stable core demo                                                                               |
| Migration conflicts   | discuss schema changes before merging                                                                     |
| Integration conflicts | merge weekly; use the app as each piece lands                                                             |
| Cloud storage setup   | use photo features as they land to catch setup issues early                                               |
