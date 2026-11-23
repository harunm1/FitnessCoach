# FitnessCoach: final report (draft 1, 22 November 2026)

Draft of the `README.md` that is due Sunday 6 December 2026, 11:59 PM (required sections: [course requirements](../COURSE_PRESENTATION_REQUIREMENTS.md)). The limit is 5,000 words; this draft has the sections Nabeegh owns written and the others as skeletons with pointers to the evidence. Each owner replaces their `[TODO: owner]` blocks, keeping to the word budget in the last section. Facts are taken from the repository on `main` at a35ef93 and from the pull requests named; re-check counts and merge states before the final copy.

## Video Demo

[TODO: Mohammad, Shubham, Nabeegh] A 2 to 5 minute video, URL here. Suggested flow: sign in, plan and "Why this plan", log a set, ask the coach, upload a progress photo ([PRESENTATION.md](../PRESENTATION.md) has the demo steps).

## 1. Team Information

| Name              | Student number | Email                              | GitHub                                                 |
| ----------------- | -------------- | ---------------------------------- | ------------------------------------------------------ |
| Mohammad Harun    | 1005235844     | mohammad.harun@mail.utoronto.ca    | [@harunm1](https://github.com/harunm1)                 |
| Farnaz Moayyedian | 1003849954     | farnaz.moayyedian@mail.utoronto.ca | [@farnazmn](https://github.com/farnazmn)               |
| Shubham Panchal   | 1012431067     | s.panchal@mail.utoronto.ca         | [@shubham2110-lab](https://github.com/shubham2110-lab) |
| Nabeegh Khan      | 1001388152     | nabeegh.khan@mail.utoronto.ca      | [@nabeegh-khan](https://github.com/nabeegh-khan)       |

Source: `README.md` team table. [TODO: each member: confirm your email is active.]

## 2. Motivation

[TODO: Mohammad] Owner of proposal section 1. Source: `ece1724_group18_project_proposal.md` section 1 (retention figures from Sperandei et al., 2016; the gap against SensAI, Google Health Coach, Fitbod, JuggernautAI and Future). Write about 150 words: the problem, who it is for, why a verified plan and a coach that knows the user's data matter.

## 3. Objectives

A short quiz produces a weekly gym, running or hybrid plan that fits the user's goal, equipment, schedule and injuries. The user logs sessions on a phone, and the plan and progress update as they train. A coach chat answers questions about the user's own plan.

The technical objective is a trustworthy coach: code checks every plan before it is saved, and failures never lose data or leave an empty screen. In practice that meant five goals, each with a way to check it:

1. A signed-in user can go from quiz to plan to a logged set to one coach exchange. Checked by the integration tests in `tests/integration/quiz-session.test.ts` and the Playwright test.
2. Every plan, from the coach or from the rule, passes the same verifier before it is shown (`src/lib/coach/verify.ts`).
3. The app stays usable when a model provider is slow, rate-limited or down: retry, then the other provider, then a rule-based plan (D6).
4. Access follows the user's tier, decided on the server on every request (`src/lib/auth/access-policy.ts`).
5. Every pull request is built and tested the way production is (`.github/workflows/ci.yml`).

Source: proposal section 2.1; `docs/ARCHITECTURE.md`.

## 4. Technical Stack and Architecture

| Layer    | Choice                                                       | Why (decision in `docs/ARCHITECTURE.md`)                                                           |
| -------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| App      | Next.js 16 App Router, TypeScript, option A (full stack)     | One codebase; Server Components read, Server Actions write (D1)                                    |
| UI       | Tailwind CSS 4, shadcn/ui on Base UI                         | Component library with the app's own theme (D20)                                                   |
| Data     | PostgreSQL 16 with Prisma 7, 20 models                       | Relational plans, workouts and logs; migrations in `prisma/migrations` (D2)                        |
| Files    | Private Cloudflare R2 bucket (S3-compatible)                 | Photos stay private; only the key is stored in `ProgressPhoto`; read through short-lived URLs (D3) |
| Auth     | Better Auth, four access tiers                               | Verified email sign-in, tier checked on the server                                                 |
| AI       | Groq first, Gemini as fallback, rule-based plan if both fail | Chosen by a fixed-profile evaluation (D4, D6, `docs/COACH_EVAL.md`)                                |
| Payments | Stripe test mode                                             | Subscriptions and webhooks, optional for free and trial use                                        |
| Hosting  | Vercel Hobby and Neon Free                                   | Preview URL and database branch per pull request (D19)                                             |

```mermaid
flowchart LR
  U[Phone or laptop] --> N[Next.js app]
  N -->|Server Actions| DB[(PostgreSQL via Prisma)]
  N -->|signed URLs| S[(Cloudflare R2: private photos)]
  N -->|route handler, streamed| C[Coach]
  C -->|providers.ts only| L[LLM APIs: Groq, Gemini]
  C --> V[Verifier in code]
  V --> DB
```

**Request path.** A page is a Server Component that reads through Prisma; a change (quiz, set, photo, subscription) is a Server Action that checks the session, validates input with a schema, and writes in PostgreSQL, using a transaction where several rows must agree (`src/lib/coach/saveWeek.ts` saves the profile and the whole week together). The only route handlers are the Better Auth endpoint, the Stripe webhook and the streamed coach reply, because a stream cannot be a Server Action.

**The coach.** `src/lib/coach/providers.ts` is the only module that calls a plan or chat model. A reply is untrusted until code has checked it:

- A safety screen runs first on chat messages: a model check with our written policy and a 3 second limit, then a word list as the deterministic floor, then a short check-in naming 9-8-8 for distress wording (D15; `safetyScreen.ts`, `safetyModel.ts`, `guardrails.ts`).
- Plans pass `verify.ts`: every exercise id exists in the library, fits the user's equipment, avoids reported injury muscles, appears once a day, the number of days matches, and each exercise carries a target effort of 6 to 9 (D17). A rejected plan is retried, then the other provider is tried, then the rule-based plan in `defaultPlan.ts` is used (D6).
- Chat replies stream a sentence at a time and each sentence is checked before it is sent (D10; `chatStream.ts`, `src/app/api/coach/route.ts`). The exchange is saved to the user's conversation as it completes.
- Chat is limited to 5 attempts a minute and 50 a day per user, taken before any model call (`src/app/coach/limits.ts`, `src/lib/coach/attemptLimit.ts`); the limiter lives in memory on each server instance and the saved-message count in PostgreSQL is the backstop across instances.
- Every model call is logged with provider, prompt version, latency and outcome (`CoachEvent`, `src/lib/coach/coachLog.ts`).
- In demo mode (`COACH_DEMO_MODE=1`) each provider call stops after 8 seconds with no retry waits, and real replies from the 30 October evaluation are served from `src/lib/coach/demoPlans.json` when the coach fails (D12).

**Why the checks live in code.** In the 30 October evaluation, a plan that "looked right" included exercise names the library does not hold; only a check against the library caught that (`docs/COACH_EVAL.md`, round 2). The same evaluation is replayed in CI (`src/lib/coach/evalReplay.test.ts`).

**Sources.** `docs/ARCHITECTURE.md` (decisions D1 to D20), `docs/RESEARCH.md`, `docs/COACH_EVAL.md`, `docs/img/architecture.png`.

## 5. Features

Each feature names its course requirement and its owner. [TODO: owner] blocks are for the person named; keep each to the budget shown.

| Feature                                                                                  | Meets                                                | Owner                                 | Evidence                                                               |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| Verified sign-in, password recovery, four access tiers, one-time seven-day trial         | Advanced feature 1: authentication and authorization | Shubham                               | `src/lib/auth`, `docs/ACCOUNTS.md`; PRs #67, #107                      |
| Stripe test-mode subscriptions and webhooks                                              | Extends feature 1                                    | Shubham                               | `src/lib/billing`, `docs/BILLING.md`; PR #68                           |
| Quiz (goal, days, equipment, level, injuries, training mode) saving a profile and a plan | Frontend, server, PostgreSQL                         | Mohammad (quiz), Nabeegh (plan logic) | `src/app/onboarding`, `src/components/QuizForm.tsx`; PRs #39, #83, #97 |
| Starter plan by rule, hybrid week for running and both                                   | Server logic                                         | Nabeegh                               | `defaultPlan.ts`, `hybridWeek.ts`, `saveWeek.ts`; PRs #47, #54, #73    |
| Today's session: log sets and runs, rest timer, finish workout                           | Frontend and backend integration                     | Mohammad                              | `src/app/session`; PR #39                                              |
| Body map opening the exercise coach                                                      | Frontend, external API                               | Mohammad                              | `src/components/BodyMap.tsx`, `bodyMapActions.ts`; PR #70              |
| Coach chat and plan generation behind the verifier and guardrails                        | Advanced feature 2: external AI API                  | Nabeegh                               | section 4; PRs #53, #56, #99, #100, #101, #124                         |
| "Why this plan" panel (checks passed, source, fallback)                                  | Explains advanced feature 2                          | Nabeegh                               | `whyThisPlan.ts`, `WhyThisPlan.tsx`; PR #88                            |
| Per-call coach log and token counts                                                      | Observability                                        | Shubham, Nabeegh                      | `coachSink.ts`; PRs #108, #98                                          |
| Progress page: streaks, calendar, muscle stats                                           | Frontend, PostgreSQL                                 | Farnaz                                | `src/app/progress`; PR #114                                            |
| Progress photos: upload, resize, private storage, signed URL                             | Cloud storage                                        | Farnaz                                | `src/lib/photos`, `src/lib/storage`; PRs #109, #113                    |
| Navigation and light and dark theme                                                      | Responsive design                                    | Farnaz                                | PR #120                                                                |

Not built at the time of this draft (fill in the final state on 5 Dec): "Personalize with the coach" (#58, PR #127 open), joint-aware substitutions and pain traffic light (#121, #122 changes requested), fatigue deload (#93), coach memory (#84), personas (#80).

[TODO: Mohammad, Shubham, Farnaz: for each of your features, 60 to 100 words: what it does, how it satisfies the requirement, one limitation.]

## 6. User Guide

Screenshots go in `docs/img/` and are linked here. Nabeegh writes the coach parts; owners write theirs.

1. **Sign up and sign in.** [TODO: Shubham] Steps from `/sign-up` to a verified account, the one-time trial on `/account`. Screenshots: sign-up, verification email, account page.
2. **Take the quiz and read your plan.** [TODO: Mohammad] Fields, what each changes, where the plan appears. Screenshot: quiz, plan.
3. **Why this plan.** Open the panel under the plan: it lists the checks the plan passed, whether the coach or the rule wrote it, and why a running week is capped. If the coach was unavailable it says the plan came from the rule. Screenshot: [TODO: Nabeegh].
4. **Log a session.** [TODO: Mohammad] Start a workout, tap Log set, the rest timer, run distance and time, Finish.
5. **Ask the coach.** Open Coach (trial, pro or admin accounts), type a question about your plan, or tap a muscle on the body map in the session screen. The reply streams in; if the coach cannot answer safely, a fixed message appears instead and nothing is lost. Free accounts see a message that the coach needs the trial. Screenshot: [TODO: Nabeegh].
6. **Progress and photos.** [TODO: Farnaz] Streaks and calendar, uploading a photo, what is stored.
7. **Billing (test mode).** [TODO: Shubham] Start a subscription with a Stripe test card, manage it in the portal.

## 7. Development Guide

Prerequisites: Node.js 22.13 or newer, npm, Docker Desktop with Compose. Full steps are in `docs/LOCAL_DEVELOPMENT.md`; this is the short path.

```powershell
npm install
Copy-Item .env.example .env
docker compose up -d
npx prisma migrate deploy
npm run db:seed
npm run dev
```

On macOS or Linux use `cp .env.example .env`. The expected local `DATABASE_URL` is `postgresql://fitnesscoach:fitnesscoach@localhost:5432/fitnesscoach?schema=public`.

**Environment (`.env.example` lists most names; `COACH_DEMO_MODE` and `GEMINI_MODEL` are documented in `README.md`, Coach keys).** `DATABASE_URL`; `BETTER_AUTH_SECRET` (32 or more characters) and `BETTER_AUTH_URL`; `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` (Mailpit works locally); `GROQ_API_KEY`, `GEMINI_API_KEY`, optional `COACH_PROVIDER`, `COACH_DEMO_MODE=1` and `GEMINI_MODEL=gemini-3.5-flash-lite` for the demo; `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` for photos; Stripe keys and price ids as in `docs/BILLING.md`. Optional local demo logins for the four tiers are created when `DEMO_PASSWORD` is set (never on Vercel).

**Database.** `prisma/schema.prisma` and `prisma/migrations` define 20 models; `npm run db:seed` loads the exercise library (free-exercise-db) with cues and common mistakes for the most used exercises. Reset with `docker compose down -v`.

**Cloud storage.** Create a private R2 bucket and an Object Read and Write token; set the four `R2_` variables. Without them the photo screens say that photo storage is not set up.

**Tests.** `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` (unit), `npm run test:integration` (needs `TEST_DATABASE_URL`; CI creates it with `npm run db:migrate:test`), `npm run build`, `npm run test:e2e` (Playwright). CI runs all of them on every pull request.

**Credentials.** [TODO: Nabeegh, on 5 Dec] State "Credentials sent to TA" after sending the password-protected archive (Groq, Gemini, R2, SMTP and Stripe test keys) to the TA, with the password in a second email.

## 8. Deployment Information

Live URL: https://fitness-coach-psi-olive.vercel.app (Vercel Hobby, owned by Mohammad's account; Neon Free PostgreSQL in Washington D.C. next to Vercel's `iad1` functions). `vercel.json` sets the build command to `scripts/vercel-build.ts`, which checks that `DATABASE_URL` and `DATABASE_URL_UNPOOLED` point at the same Neon branch, runs `prisma migrate deploy`, seeds the exercise library (with no demo logins), and runs `next build`. Each push to `main` redeploys production and applies new migrations; each pull request gets a preview URL and its own Neon branch. Environment variables and the one-time setup are in `README.md` "Deploy" (D19). Sources checked on 5 and 20 November 2026 are listed under D19.

Known limits at the time of this draft: the free tiers of Groq, Gemini, Neon and Vercel rate-limit or cap usage, which is why the coach has a fallback chain and a demo mode; sign-up needs a working SMTP service for the verification email [TODO: Mohammad: name the service]; a coach streaming fault seen on the live app on 21 November was found and fixed in PR #124 [TODO: Nabeegh: confirm merged and tested live].

## 9. AI Assistance and Verification (summary)

Details and prompts are in `ai-session.md`; this is the summary.

- **Where AI helped.** Drafting and reviewing code and tests (for example the streaming route, the verifier tests and the repeated-set-save tests), reading library documentation, debugging, and checking sources for the research notes. Architecture choices were made by the team from evidence in `docs/RESEARCH.md` and `docs/COACH_EVAL.md`, with AI used to explore options.
- **A representative mistake.** On 21 November the live coach chat failed with `coach: stream failed unknown` and then a rate-limit message. A first reading pointed at the model providers and their keys. A local run with the deployed provider order showed both answering normally, and a throwaway route under `next dev` showed that `revalidatePath` throws inside a streamed response after the exchange was saved, so saved replies were reported as unsaved and each resend counted against the app's own limit. The regression test failed on `main` before the fix (PR #124, issue #123).
- **How correctness was verified.** Tests first and shown failing where behaviour changes; type check, lint and Prettier; unit, integration (PostgreSQL) and end-to-end suites in CI on the pushed commit; and a separate reviewer reading each change without seeing the author's reasoning, with its findings fixed before merge. Model outputs are never trusted directly: the verifier and guardrails are code.
- **Limits.** AI-written tests that pass on the first run prove behaviour that already existed (as with the repeated-set-save tests in PR #128), so each pull request says which tests were red first and which pin existing behaviour.

## 10. Individual Contributions

Merged pull requests by author on 22 November 2026 (`gh pr list --state merged`): Nabeegh 28, Shubham 10, Farnaz 7, Mohammad 5; commits on `main`: Nabeegh 304, Shubham 33, Mohammad 42 (two identities), Farnaz 17 (two identities). Commit counts are not the measure: many of Nabeegh's commits are small documentation, review-fix and merge commits, and the grading looks at the work, so the entries below name the work.

**Nabeegh.** Foundation: Prisma schema and migrations, exercise seed, CI pipeline (#2). The AI coach (#11): providers with fallback, plan verifier, rule-based starter plan, hybrid and running weeks (#47, #54, #73, #97), chat with guardrails (#53, #100), sentence-by-sentence streaming (#56), demo mode and cached plans (#99), target effort per exercise (#101), "Why this plan" (#88), coach model-call record fields (#98, open), the streaming fix (#124, open), "Personalize with the coach" (#127, open), the coach evaluation and its CI replay (`docs/COACH_EVAL.md`). Deployment: Vercel and Neon configuration and the production build script (#61, D19). Architecture and research documents (`docs/ARCHITECTURE.md`, `docs/RESEARCH.md`), proposal section 2, shadcn/ui setup (#77), the root error state (#74) and loading states inside pages (D16). Reviews of teammates' pull requests, including #121 and #122.

**Shubham.** [TODO: Shubham] Source: PRs #67, #68, #83, #107, #108, #119, `docs/ACCOUNTS.md`, `docs/BILLING.md`, `docs/COACH_ACCESS.md`, `docs/COACH_EVENTS.md`.

**Mohammad.** [TODO: Mohammad] Source: PRs #39, #70, #102, #115, #121 and #122 (open), the Vercel and Neon project and its settings (D19), `git log --author=harunm1`.

**Farnaz.** [TODO: Farnaz] Source: PRs #113, #114, #120, `src/lib/photos`, `src/lib/storage`, `src/app/progress`, research notes (#25 nearby gyms decision), `git log --author=farnazmn`.

## 11. Lessons Learned and Concluding Remarks

**Nabeegh.** A model is a source of proposals, not of facts: every number and every exercise it names has to be checked against something the code owns, and that check is the feature. The failure that mattered most (the 21 November chat fault) was ours, not the provider's, and was only found because the cause was reproduced instead of guessed. Free tiers shape the design: rate limits on three services pushed us to a fallback chain, a cached demo path and per-pull-request databases. Reviews took longer than code in the last two weeks; small pull requests, one issue each, kept them possible. What we would do differently: wire the end-to-end path (quiz, plan, log, chat) on the deployed app in the first week of November, not the third.

[TODO: Mohammad, Shubham, Farnaz: 80 to 120 words each: one thing learned, one thing done differently.]

## Word budget (delete before submitting)

| Section                        | Owner                                   | Target words              |
| ------------------------------ | --------------------------------------- | ------------------------- |
| Team, Video                    | all                                     | 100                       |
| Motivation                     | Mohammad                                | 150                       |
| Objectives                     | Nabeegh                                 | 200                       |
| Stack and architecture         | Nabeegh                                 | 900                       |
| Features                       | all                                     | 700                       |
| User guide                     | all                                     | 500                       |
| Development guide              | Nabeegh                                 | 450                       |
| Deployment                     | Nabeegh                                 | 250                       |
| AI assistance and verification | Nabeegh, each member adds two sentences | 400                       |
| Individual contributions       | each own, about 150 each                | 600                       |
| Lessons and conclusion         | each member                             | 500                       |
| Total                          |                                         | about 4,750 (limit 5,000) |
