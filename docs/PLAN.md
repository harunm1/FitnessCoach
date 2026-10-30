# Plan (draft)

Draft for proposal section 3. One proposal section per person. Owners are filled in once each person agrees at the next meeting.

## Dates

| Window          | Goal                                                    | Course deadline                                                             |
| --------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| 21 to 25 Oct    | architecture, plan and skeleton                         | team formation on Quercus, Sun 25 Oct                                       |
| 26 Oct to 8 Nov | proposal written; schema, sign-in and CI in place       | **proposal, Sun 8 Nov (15%)**                                               |
| 9 to 18 Nov     | core path works: quiz, plan, logged workout             | team health check, Wed 18 Nov                                               |
| 19 to 23 Nov    | planned features; features and new code stop Mon 23 Nov |                                                                             |
| 24 to 26 Nov    | testing, fixes and demo dry runs only                   | introduction Wed 25 Nov; slides Thu 26 Nov                                  |
| 27 Nov to 6 Dec | live demo; README report, `ai-session.md`, video        | **presentation, Fri 27 Nov or Fri 4 Dec (10%)**; **final, Sun 6 Dec (35%)** |

## Proposal sections

| Section                                 | Weight | Owner                                                                          |
| --------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| 1. Motivation                           | 20%    | open (similar apps and sources are in [RESEARCH.md](RESEARCH.md#1-motivation)) |
| 2. Objectives, architecture, features   | 50%    | Nabeegh                                                                        |
| 3. Plan and responsibilities            | 15%    | open (draft in this file)                                                      |
| 4. Initial reasoning and AI exploration | 15%    | open                                                                           |

## Build areas

Each area is one person's issues, branches and pull requests, so contribution shows in the Git history.

| Area                     | What it covers                                                             | Owner   |
| ------------------------ | -------------------------------------------------------------------------- | ------- |
| Foundation               | Next.js skeleton, Prettier and ESLint, CI, Prisma schema and seed          | Nabeegh |
| AI coach                 | plan generation, the verifier, streamed chat, body-map follow-up questions | Nabeegh |
| Accounts                 | Better Auth sign-in, the four access tiers, Stripe test mode               | open    |
| Quiz and workout session | quiz, body map, today's session screen, Redux Toolkit                      | open    |
| Progress                 | workout history, streaks, heatmap, photos (Spaces, `sharp`)                | open    |

The demo path is foundation, accounts and the AI coach. Quiz, session and progress add to it, and each starts once the schema is merged.

## Integration

- The Prisma schema and the coach's plan JSON are agreed first, so every area builds against them.
- One issue per task, one branch per issue, a pull request with `Closes #n`, one teammate review, squash and merge.
- The reviewer is the teammate whose area the change touches, so reviews spread across the team instead of landing on one person. Every request carries a review-by date three to four calendar days out, the same rule for everyone. A branch carrying more than one person's commits merges with a merge commit, so each commit keeps its author.
- CI runs lint, typecheck and tests on every pull request.
- Checkpoints: Sat 14 Nov (core path end to end), Sat 21 Nov (everything working end to end). Features and new code stop Mon 23 Nov; after that only fixes, so the presentation shows finished work and the last two weeks go to testing, the report and the video.

## Risks

| Risk                                       | Mitigation                                                     |
| ------------------------------------------ | -------------------------------------------------------------- |
| LLM free tier rate-limited during the demo | Groq with Gemini fallback; one recorded backup                 |
| Stripe takes longer than planned           | off the demo path; tiers work from a trial end date without it |
| An area stalls                             | areas off the demo path can slip without breaking the demo     |
