# Plan

Draft for proposal section 3 (plan and responsibilities). Owners are added as people take a slice; nobody is assigned without agreeing.

## Dates

| Window | Goal | Course deadline |
|---|---|---|
| 20 to 25 Oct | architecture and plan drafted | team formation, Sun 25 Oct |
| 26 Oct to 8 Nov | proposal written; skeleton: Next.js app, Prisma schema, sign-in, CI on pull requests | **proposal, Sun 8 Nov (15%)** |
| 9 to 18 Nov | core: quiz, AI plan, workout logging, tiers | team health check, Wed 18 Nov |
| 19 to 26 Nov | planned features, demo rehearsal; work frozen 26 Nov | introduction Wed 25 Nov; slides Thu 26 Nov |
| 27 Nov to 6 Dec | presentation with live demo; README report, `ai-session.md`, video | **presentation, Fri 27 Nov or Fri 4 Dec (10%)**; **final, Sun 6 Dec (35%)** |

## Slices

| Slice | Owner | Lands in |
|---|---|---|
| Architecture, plan, proposal sections 2 and 3 | Nabeegh | `docs/` |
| Skeleton, database schema, CI | open | `prisma/`, `.github/workflows/` |
| Sign-in, access tiers, Stripe test mode | open | `src/lib/auth`, billing routes |
| AI coach: plan generation, chat, form feedback | open | `src/lib/ai`, coach routes |
| Quiz, body map, workout session (Redux Toolkit) | open | `src/app/quiz`, `src/components` |
| Progress: logging, streaks, heatmap, photos | open | progress pages, `src/lib/storage` |
| Proposal sections 1 and 4 (motivation; reasoning and AI exploration) | open | the proposal |

Each slice is someone's own commits, Issues and pull requests. The demo path (quiz, plan, one coached exercise, a logged workout) depends only on the skeleton, sign-in and the AI coach. The other slices add to it.

## Integration

- The schema and the AI coach's JSON shape are agreed before feature work, so slices can be built in parallel against them.
- Every pull request runs lint, typecheck and tests in CI.
- Checkpoints: Sat 14 Nov (core path works end to end) and Sat 21 Nov (everything, demo dry run).

## Risks

| Risk | Mitigation |
|---|---|
| Next meeting is not until reading week, close to the 8 Nov deadline | proposal sections written asynchronously on Discord before then |
| AI free tier is rate-limited or down during the demo | Groq fallback; one recorded backup of the coach |
| Stripe takes longer than expected | it sits off the demo path; tiers work from a date field without it |
| Too many features for four people | two promised, the rest planned and shown only if finished |
