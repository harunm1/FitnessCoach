# Execution audit, Sunday 15 November 2026

Nabeegh's audit of what the team delivered from Friday 13 November 00:00 to Sunday 15 November 13:40, read from `git log --all --since=2026-11-13`, the GitHub pull requests, reviews, comments and issues, and the CI runs on `main`. Every claim names the commit, pull request or CI run it rests on. `main` is at 0378a60.

## What happened since Friday

### Merged into `main` (13 Nov)

| PR   | What                                                  | Author   | Merge commit | Main CI after the merge       |
| ---- | ----------------------------------------------------- | -------- | ------------ | ----------------------------- |
| #105 | exercise coach needs sign-in, one history per user    | Shubham  | 0c30861      | 43492162721 pass              |
| #107 | coach access tiers and persistent plan-request limits | Shubham  | d8ecf76      | 43492647478 pass              |
| #109 | private progress photo storage in R2                  | Farnaz   | 7277a58      | 43494071335 pass              |
| #102 | curated exercise library with cues                    | Mohammad | ce1d322      | 43497195274 pass              |
| #53  | coach chat turn with guardrails and provider fallback | Nabeegh  | ae7f4b3      | 43497641917 pass              |
| #96  | coach chat screen                                     | Nabeegh  | cd69312      | 43498144713 fail (flake #112) |
| #73  | starter plan picks strength exercises only            | Nabeegh  | 4895d8c      | 43507227219 pass              |
| docs | checkpoint 1 page (`docs/checkpoints/2026-11-15.md`)  | Nabeegh  | 0378a60      | 43746517818 fail (flake #112) |

Both red runs fail the same integration test, "keeps exercise-chat history and model context separate for each signed-in user" (`tests/integration/quiz-session.test.ts`): the two chat rows saved in one transaction share a `createdAt`, so their order is not fixed. Issue #112 (Shubham) records it; #115 (Mohammad, opened 15 Nov 01:42) adds the id as a tie-break and is open with no review.

### Opened, reviewed or commented since Friday

| PR   | Author   | State on 15 Nov 13:40                                                                                                                    |
| ---- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| #110 | Farnaz   | profile photos; approved by Nabeegh 13 Nov (review 5893770530); Farnaz answered all six notes and merged main (comment 6866695068)       |
| #113 | Farnaz   | opened 13 Nov 23:13: #109 review follow-ups (photo limits); no review yet; review owed by Nabeegh                                        |
| #114 | Farnaz   | opened 14 Nov 01:16: progress page; no review yet; review owed by Nabeegh                                                                |
| #115 | Mohammad | opened 15 Nov 01:42: fixes #112; no review yet; review owed by Nabeegh                                                                   |
| #74  | Nabeegh  | root error and loading states; approved by Mohammad 15 Nov 04:32 (review 5909064433)                                                     |
| #81  | Nabeegh  | integration tests in CI; approved by Mohammad 15 Nov 04:26 (review 5909021034)                                                           |
| #88  | Nabeegh  | "Why this plan" panel; approved by Mohammad 15 Nov 04:17 (review 5908991093)                                                             |
| #108 | Shubham  | coach log table; approved 13 Nov; conflict resolution staged locally, push refused (BLOCKED.md, 13 Nov 14:36)                            |
| #106 | Shubham  | duplicate of #107 (same commit ac0d634, now in `main`); comment 6862897746 asks Shubham to close it                                      |
| #77  | Nabeegh  | shadcn/ui; no review; `main` merged locally 15 Nov 13:26 (493aca0), not pushed                                                           |
| #61  | Nabeegh  | deployed preview; no review; a merge of `main` was started 15 Nov 13:28 and stopped with conflicts in `.env.example` and ARCHITECTURE.md |

### Commits by author since Friday

`git log --all --since=2026-11-13`: Nabeegh 14 (merges and docs), Farnaz 11 (on #110, #113, #114), Mohammad 5 (#102 merge, #111 fix 3dfcce8, #115 391cc04). Shubham has no commit since Friday; his #105 and #107 were merged on 13 Nov.

### Issues changed since Friday

Closed: #104 (by #105), #111 (by #102, 3dfcce8), #71 (by #73), #63 (by #96). Opened: #112 (chat order flake, Shubham). Still open: #72 (loading and error states, #74), #75 (shadcn/ui, #77).

## Core path on `main`

| Step                 | State on `main` at 0378a60                                                                                                                                                                                                  | Delivered by                 | Owner    | What blocks it                                                                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sign in              | works in CI: `tests/e2e/auth.spec.ts` passed in run 43507227219 on 4895d8c                                                                                                                                                  | #67, #107 (d8ecf76)          | Shubham  | nothing                                                                                                                                                                                                      |
| Quiz                 | works in CI: `tests/e2e/quiz-session.spec.ts`, same run                                                                                                                                                                     | #39, #83                     | Mohammad | nothing                                                                                                                                                                                                      |
| Workout plan         | works in CI: the same browser test reaches the plan on `/session`                                                                                                                                                           | #39, #73 (4895d8c)           | Nabeegh  | nothing                                                                                                                                                                                                      |
| Logged workout       | works in CI: the same browser test logs a set and finishes the workout                                                                                                                                                      | #39                          | Mohammad | nothing                                                                                                                                                                                                      |
| One coach exchange   | in code: action, screen and saved-reply integration tests (`tests/integration/coach-access.test.ts`); browser test covers only the signed-out redirect (`tests/e2e/coach-signed-out.spec.ts`). Not shown with a real model. | #53 (ae7f4b3), #96 (cd69312) | Nabeegh  | a new account is FREE and `/coach` refuses FREE (#107), so the demo starts the trial on `/account` first; needs `GROQ_API_KEY` in the running environment; live walk-through not run (laptop memory, 15 Nov) |
| Progress photo in R2 | in code: upload Server Action, private bucket, signed URLs, photo row with the key (`src/app/progress/photos/actions.ts`, `src/lib/storage/r2.ts`); no browser test on `main`                                               | #109 (7277a58)               | Farnaz   | no R2 bucket settings in any environment, so an upload stops at "Photos can't be saved right now"; follow-ups in #113, profile photos in #110, progress page in #114 (all open)                              |

## Course core requirements on `main`

| Requirement                              | State at 0378a60                                                       | Rests on                                     | Owner               | What blocks it                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------- |
| TypeScript, Next.js, Tailwind CSS        | done                                                                   | #1; CI build step, run 43507227219           | everyone            | nothing                                                                                     |
| shadcn/ui or similar                     | missing: no `components.json`, no `src/components/ui`                  | #77 (open, no review), issue #75             | Nabeegh             | #77 not pushed with `main` merged; no approval; three-day window long passed (opened 8 Nov) |
| Responsive design                        | partly: phone-width browser tests for sign-up and account only         | `tests/e2e/account-ui.spec.ts`               | each screen's owner | quiz, session, coach and photo screens unchecked at phone width                             |
| PostgreSQL with TypeScript server code   | done: Prisma 7, migrations applied to PostgreSQL 16 in CI              | #2, #44; CI step `db:migrate:test`           | Nabeegh             | nothing                                                                                     |
| Cloud storage linked to users or records | code done, not demonstrated                                            | #109 (7277a58)                               | Farnaz              | R2 bucket and keys not set anywhere; #113 open                                              |
| Authentication and authorization         | done                                                                   | #67, #107 (d8ecf76)                          | Shubham             | nothing                                                                                     |
| AI coach (external API)                  | done in code (plans #48, chat #53, screen #96); no live exchange shown | ae7f4b3, cd69312                             | Nabeegh             | walk-through with a model key and a trial account                                           |
| Loading and error states                 | partly: only `src/app/coach/error.tsx`                                 | #74 (approved 15 Nov, not merged), issue #72 | Nabeegh             | #74 needs `main` merged (done locally, 07c1182, not pushed), checks and the verifier passes |
| Deployment (proposal)                    | missing                                                                | #61 (open, no review), issue #57             | Nabeegh             | merge of `main` stopped with two conflicts; Neon and Vercel settings not made               |

## Half-done work found

The previous checkpoint session (13:15 to 13:35) left three of Nabeegh's branches mid-way. None was pushed.

| Branch                              | Worktree               | State                                                                                         |
| ----------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------- |
| `nabeegh/75-shadcn` (#77)           | `../FitnessCoach-wt75` | `main` merged, commit 493aca0, clean; checks and verifier passes not run                      |
| `nabeegh/72-loading-error` (#74)    | `../FitnessCoach-m74`  | `main` merged, commit 07c1182 (detached), clean; checks and verifier passes not run           |
| `nabeegh/57-deployed-preview` (#61) | `../FitnessCoach-wt61` | merge of `origin/main` in progress since 13:28; `.env.example` and ARCHITECTURE.md conflicted |

Other dirty worktrees predate Friday (`../FitnessCoach-m108`: Shubham's #108 merge staged for BLOCKED.md; `rr61`, `rr74`, `walk`: 11 to 13 Nov experiments) and are left as they are.

## What this audit changes in the plan

1. Finish #77, #74 and #61 in that order (course requirements first), each with `main` merged, checks, two verifier passes and a push.
2. Review #115 first: it turns `main` green again.
3. Review #113 and #114 against the practices list, including the Lecture 9 rows.
4. Run the walk-through on `main` once the laptop has room for the database, the app and a browser; until then, the steps above are verified by CI tests only.

## Lecture 10 (Fri 20 Nov): DigitalOcean Spaces and Better Auth

Lecture 10 covers DigitalOcean Spaces and Better Auth (course page "lecture-10"; Better Auth docs at better-auth.com/docs/introduction). It matters to two parts of our code. No code changes until after the lecture.

- **Better Auth** (Shubham's, #67; version 1.7.14 in `package.json`): `src/lib/auth/core.ts` (server instance), `src/lib/auth/client.ts` (browser client used by `src/components/auth/auth-form.tsx` and `change-password-dialog.tsx`), `src/app/api/auth/[...all]/route.ts` (the Route Handler), `src/lib/auth/session.ts` (`requireUser`, used by every Server Action), and the tier and access files in `src/lib/auth/` (#107). Anything the lecture recommends goes to Shubham as a comment.
- **DigitalOcean Spaces**: we use Cloudflare R2 (#109, D3). Only `src/lib/storage/r2.ts` talks to the S3 API (practices row 14), so moving to Spaces would mean new settings and that one module, plus the ACL difference in row 15.

## Addendum, 15 Nov 13:35 to 13:45

- Lecture 9 rows 8 to 19 added to `docs/ENGINEERING_PRACTICES.md` (ef89498). Checking `main` against them found no real gap, so no issue was opened (details in the rows' last column).
- Reviews posted as comments: #115, #113 and #114, none blocking. #115 still needs one approval.
- Main CI on ef89498 (run 43747873093) failed on the same flaky test as before (#112). #115 fixes it.
