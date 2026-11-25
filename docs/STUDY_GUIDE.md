<!-- Study guide for answering the course Q&A about FitnessCoach on Fri 4 Dec 2026 (Nabeegh's doc). -->

# FitnessCoach study guide for the Q&A

Written Sun 22 Nov 2026 against `main` at commit `a65996d`. It is meant to be read aloud or listened to: short sentences, one idea at a time, the answer first and the evidence after. Every number and file name was read from the code or the docs on that commit. Re-check the numbers on Tue 24 Nov and again on Thu 3 Dec, because pull requests merge in between (section 0 lists which ones change an answer).

Sources used: the code in `src/`, `prisma/` and `.github/`; [ARCHITECTURE.md](ARCHITECTURE.md) (decisions D1 to D22); [COURSE_PRESENTATION_REQUIREMENTS.md](COURSE_PRESENTATION_REQUIREMENTS.md); [COACH_EVAL.md](COACH_EVAL.md); [PLAN.md](PLAN.md); [PRESENTATION.md](PRESENTATION.md); the proposal in [proposal/](proposal/); the design reviews in [design-reviews/](design-reviews/); the report draft in [report/FINAL_REPORT_DRAFT.md](report/FINAL_REPORT_DRAFT.md); and the git history.

## 0. Before you start

### The three-part answer

The course asks for a direct answer, then the evidence, then the limit. Say it in that order, every time.

1. **Answer.** One or two sentences. No warm-up.
2. **Evidence.** A file, a test, a number, or what is on screen.
3. **Limit.** What it does not do yet. "We have not built that. It is planned for 5 December" is a good answer when it is true. A wrong answer costs more than an honest gap.

### What the rubric rewards

Twenty points. Clarity and communication, 6. Technical progress and demonstration, 10. Advanced features and completion plan, 4. Only what is shown or said earns marks. Only work finished by Thu 26 Nov may be shown on the 27th or 4th.

### Open pull requests that change an answer once merged

State of the board on Sun 22 Nov evening. If the pull request is not merged by Thu 26 Nov, use the "today" column.

| PR         | What it is                                                               | Today (on main)                                                                                | After it merges                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #146       | Coach replies cut at the token limit, shorter answers (#137)             | A long chat reply can stop mid-sentence with no note. Chat token cap is 300.                   | A cut reply ends with a visible note. Cap is 600. Prompts ask for 2 to 4 sentences.                                                                                     |
| #147       | Import workouts from a Hevy CSV (#131)                                   | No import page. Decision D22 is written, the code is not on main.                              | An Import page; saved as ordinary workouts marked "Imported"; one migration adds `Workout.source` and `Workout.importKey`.                                              |
| #148       | Quiz shows saved answers; "Bodyweight" exclusive; states the day split   | After saving, the quiz can show default answers again.                                         | The quiz keeps the saved answers; for "Both" it says how many strength and run days.                                                                                    |
| #149       | Starter plan uses level and equipment (#139, #145)                       | The starter plan takes the first library exercise that fits each slot. Level is not used.      | Exercises are ranked by level and equipment, big lifts first, longer days for experienced users.                                                                        |
| #150       | Coach panel copy, local times, weight hint                               | Times can show in server time (UTC). The body-map panel footer says no AI coaching yet.        | Times show in the viewer's zone. Footer text is corrected.                                                                                                              |
| #127       | "Personalize with the coach" (#58)                                       | No live path from the app to a model-written plan. The button does not exist on the plan page. | The action exists. A button still has to be placed on the plan screen (Mohammad's file).                                                                                |
| #128       | Tests that a repeated set save stores one row                            | The save is already an upsert. Nothing proves it in CI.                                        | Three integration tests prove it. No behaviour change.                                                                                                                  |
| #130       | Fatigue deload rule (#93)                                                | Not on main.                                                                                   | A pure function, `proposeDeload`. No screen yet (#129).                                                                                                                 |
| #126       | "Why this plan" follow-ups                                               | The panel can name the wrong provider after a rejected reply; the run cap text omits the floor | Fixed.                                                                                                                                                                  |
| #78, #89   | Indexes; one active plan, one open workout, range checks in the database | Those rules are enforced in code only. A double submit can race.                               | The database enforces them.                                                                                                                                             |
| #98        | Token counts and guardrail verdict on the call record                    | The token and verdict columns exist on `CoachEvent` but stay empty.                            | Plan calls fill token counts. Chat token counts and the chat verdict are still empty.                                                                                   |
| #121, #122 | Joint-aware swaps; pain traffic light (Mohammad)                         | Not on main.                                                                                   | #121 adds the swap-reason column; #122 adds pain columns to `SetLog` and contains #121's changes. Both had changes requested on 22 Nov; cut if not fixed by Mon 30 Nov. |

Already merged and counted below: #124 (live chat reported saved replies as unsaved; fixed) and #87 (the eval can repeat each profile and report consistency).

## 1. The app in 60 seconds

FitnessCoach is a website for people who train on their own. You take a short quiz: your goal, your level, how many days a week, what equipment you have, any injuries, and whether you want lifting, running or both. The app turns that into a weekly plan, instantly, from a rule in our code. It does not wait for an AI.

At the gym you open today's session. You tap to log each set. Big buttons, a rest timer, a body map that opens exercise help for the muscle you tap.

An AI coach answers questions about your own plan. It knows your goal, level, equipment, the muscles your injuries tell it to avoid, and your next planned session. It does not read your logged sets yet. Everything it says passes through checks written in code: a safety screen on what you type, and a reply check before any sentence reaches you. Model-written plans, which can only use exercises from our library and pass the verifier, go live with pull request #127 and a button on the plan screen. Today the starter plan is the rule-based one.

After training you see streaks, a calendar, per-muscle stats and progress photos. The photos go to a private Cloudflare R2 bucket.

The stack is Next.js with TypeScript and Tailwind, shadcn/ui components, PostgreSQL through Prisma on Neon, Better Auth for sign-in, Stripe in test mode for subscriptions, Groq and Gemini for the coach, R2 for photos, and Vercel for hosting.

One sentence to remember: **a quiz becomes a plan we can trust, and a coach that is checked by code answers questions about that plan.**

## 2. One user journey, end to end

Walk through this when someone asks "what happens when I use it". Each step names the layer.

### Step 1. Sign up and verify the email

- The sign-up page is a form in the browser. It talks to Better Auth through one route handler, `src/app/api/auth/[...all]/route.ts`.
- Better Auth writes the user, account and session rows to PostgreSQL through its Prisma adapter.
- Email verification is required (`requireEmailVerification: true` in `src/lib/auth/core.ts`) and a verification email is sent on sign-up. The email goes out through nodemailer over SMTP, so the live site needs the SMTP settings in its environment.
- A user who has not verified cannot use the app. `getVerifiedUser()` in `src/lib/auth/session.ts` returns nothing for an unverified account, and every protected page and action calls `requireUser()`, which redirects to `/sign-in`.

### Step 2. The quiz

- `/onboarding` renders `QuizForm`. Submitting it calls the Server Action `saveQuizProfile` in `src/app/onboarding/actions.ts`.
- The action re-reads the signed-in user on the server. It validates the input with a zod schema (`src/lib/onboarding/schema.ts`): goal, level, training mode, days a week from 1 to 7, at least one equipment item, injuries text up to 500 characters.
- It then does three writes in one database transaction: save the profile, switch off the old active plan, create the new plan. If any write fails, none is kept.

### Step 3. The starter plan

- The plan comes from a rule, not a model. `buildDefaultPlan` in `src/lib/coach/defaultPlan.ts` picks exercises from our library, strength category only (D18), that fit the user's equipment and avoid the muscles named in their injuries.
- Running and "Both" users go through the hybrid builder, which splits strength days and run days by goal and days a week (D9), and caps a run week at 10% over last week's logged distance (D8).
- The "Why this plan" panel shows the rows behind a plan: where it came from, what rules shaped it.
- Why a rule and not a model: no wait of 2 to 15 seconds at sign-up, no quota spent on every new user, and the user has a plan even if every provider is down (D11).

### Step 4. Start a workout and log sets

- `/session` is a Server Component that reads the user's active plan and open workout from PostgreSQL. It is marked `force-dynamic` so it never shows stale data.
- "Start workout" calls `startOrResumeWorkout`, which creates a `Workout` row or resumes the open one.
- "Log set" calls `logSet` in `src/app/session/actions.ts`. It checks the signed-in user, checks the exercise belongs to the user's own active plan, then upserts a `SetLog` row keyed on workout, exercise and set number. It then calls `revalidatePath("/session")`, so the page reads what was stored.
- Which plan day comes next: the number of finished workouts modulo the number of plan days (`getNextPlanDayIndex`). There is no automatic weight progression yet. The plan stores sets, reps and rest; the user types the weight.

### Step 5. Coach chat, streamed

- `/coach` is the chat page. The browser posts JSON to the route handler `src/app/api/coach/route.ts`.
- The route checks, in order: the request's origin matches the site; the user is signed in with a tier that allows the coach (trial, pro or admin); the content type is JSON; the body is at most 64,000 bytes; then the user's context and saved conversation are loaded; then the per-minute and per-day limits (the database count, then the in-memory counter); then the chat turn, which applies the 1,000-character cap.
- `coachReplyStream` runs one fixed turn: the safety screen on the user's message; the model call with a prompt built from this user's plan and profile; the reply is released a sentence at a time, and before each sentence the reply so far is checked (D10).
- The finished exchange is saved to the user's conversation in PostgreSQL. One `CoachEvent` row records each model call: provider, prompt version, latency and outcome. It stores no prompt text and no reply text.

### Step 6. Progress and photos

- `/progress` reads the user's workouts and sets and shows streaks, an activity calendar and per-muscle stats.
- A photo is shrunk in the browser to under 4 MB, then sent to a Server Action. The server checks the type (jpeg, png or webp), resizes with `sharp` to at most 1,600 pixels on the long side, converts to WebP at quality 80, and uploads to a private Cloudflare R2 bucket through R2's S3-compatible API. Only the storage key goes into the `ProgressPhoto` table (D3).
- To show it, the server makes a signed URL that expires after 5 minutes (`VIEW_LINK_SECONDS` in `src/lib/photos/gallery.ts`). The bucket is never public.

### Step 7. Trial and Stripe test mode

- Free users can take a 7-day trial from the account page. `activateTrial` in `src/lib/auth/trial.ts` is one conditional database write: it only succeeds if the email is verified, the tier is still FREE, and no trial was ever started. Two fast clicks cannot restart or extend it.
- Pro comes from a Stripe Checkout session in test mode. Stripe calls our webhook at `/api/stripe/webhook`. The handler checks the signature, rejects live-mode events ("Test events only"), and stores each Stripe event id once, in the same transaction as its effect, so a retried event cannot apply twice.
- The tier is not stored as a fact. On every protected request, `resolveAccess` recomputes it from the stored tier, the trial end date and the billing record. When the trial runs out, the user falls back to free on their next request. No scheduled job is needed.

## 3. Every component: what, why, how it fails

For each: what it is, why we chose it, and what happens when it breaks. The "why" is on record in ARCHITECTURE.md; the decision number is given.

### Next.js App Router (D1)

- **What.** One TypeScript codebase for pages and server logic. Server Components read data on the server. Server Actions write. Route handlers exist only where a plain HTTP endpoint is needed: the Better Auth endpoint, the Stripe webhook and the streamed coach reply.
- **Why.** Nothing outside the app calls the backend, so no public REST API is needed. A Server Action is a typed form handler with built-in CSRF protection, and validation sits next to the database call. We compared it with React plus Express in [RESEARCH.md](RESEARCH.md) section 2. This is "option A" in the course handout.
- **How it fails.** We are tied to Next.js; a mobile app later would need an API. A bug in a Server Component shows the root error page (`src/app/error.tsx`, D16), which has a retry button.

### Server Actions

- **What.** Functions marked `"use server"`: `saveQuizProfile`, `logSet`, `startOrResumeWorkout`, `finishWorkout`, the photo upload and delete, the account and billing actions.
- **Rule we follow.** Every action re-reads the signed-in user on the server and puts the user id into the database query. The browser never says who it is. Forged owner or workout ids in the form are ignored; tests in `tests/integration/quiz-session.test.ts` send them on purpose.
- **How it fails.** A failed save returns an error message and no row changes. Suspected, not reproduced or tested: a fast double tap on "Log set" for a brand new set may show "Could not save this set" (the upsert's `where` includes the owner, which may make Prisma read then create). Repeating the same set is covered by the upsert; PR #128 adds tests.

### Prisma and PostgreSQL on Neon (D2, D19)

- **What.** 20 models: User, Profile, Exercise, Plan, PlanDay, PlanExercise, PlanRun, Workout, SetLog, RunLog, CoachEvent, Conversation, Message, ProgressPhoto, Session, Account, Verification, RateLimit, BillingAccount, StripeWebhookEvent. Prisma 7 with the `pg` driver adapter. Eight migration folders in `prisma/migrations`, committed.
- **Why.** The data is relational: user to plan to day to exercises, and user to workout to logged sets. Prisma gives typed queries and committed migrations. Neon is free, keeps the database with no expiry, and gives each preview deployment its own database branch.
- **Constraints in the schema.** One profile per user. No exercise twice on one plan day (`@@unique([planDayId, exerciseId])`). One row per set (`@@unique([workoutId, exerciseId, setNumber])`). Photo keys are unique.
- **How it fails.** Neon's free tier sleeps after about 5 idle minutes, so the first request after a pause is slower (D19). Rules like "one active plan per user" are enforced in code today; PR #89 moves them into the database.

### Sign-in and verified email (Better Auth)

- **What.** Better Auth with the Prisma adapter. Email and password, verification email required, password reset, change password. Rate limits on the send-verification endpoint (5 per 60 seconds).
- **Why.** Accounts are a course advanced feature, and the identity must be server-checked on every request.
- **How it fails.** If the SMTP settings are missing on the live site, verification emails do not send and nobody can finish signing up. That is the first thing to check before a demo.

### Access tiers and Stripe test mode

- **What.** Four tiers: FREE, TRIAL, PRO, ADMIN. FREE gets the quiz, the default plan and logging. TRIAL, PRO and ADMIN add the coach. ADMIN can manage content. The rule is one pure function, `resolveAccess` in `src/lib/auth/access-policy.ts`, so it is unit-testable. The trial lasts 7 days.
- **PRO is paid** only when the tier is PRO and the billing record is `active` and `paidUntil` is in the future. Otherwise the user falls to TRIAL (if a trial is still running) or FREE.
- **Why.** Checking the tier on the server on every request means the browser cannot grant itself access. Recomputing from dates means expiry needs no cron job.
- **Stripe.** Test mode only, with test cards. Webhook events are verified by signature and de-duplicated by event id. A failed event rolls back so Stripe retries it.
- **How it fails.** Payment is not real; no live keys exist. If the webhook secret is wrong, the webhook answers 400 and the subscription is not recorded.

### The AI coach

Six parts. Learn them in this order.

**1. One door to the models.** `src/lib/coach/providers.ts` is the only file that calls a model API. No page, action or component calls Groq or Gemini directly. So every model path gets the same timeouts, retries, fallback and logging (D4, D6).

**2. Providers and fallback.**

- Lead provider: Groq, model `openai/gpt-oss-120b`. Second: Gemini, default model `gemini-3.5-flash` in code (a setting can change it).
- Each call stops after 30 seconds. For plan calls in demo mode (`COACH_DEMO_MODE=1`), each call stops after 8 seconds and nothing waits for a retry (D12). The streamed chat keeps the 30-second timeout and has no retry.
- Plan calls: on a rate limit or a server error, the call retries with a wait that respects the provider's retry hint, then the other provider is tried. Streamed chat has no retry: it switches provider only if the first one fails before any text arrives. If both fail, a plan request gets the rule-based plan, and a chat message gets a short fixed "can't answer right now" reply. Logging and the rest of the app keep working.
- Check on 24 Nov and before the 4th: which Gemini model the live site uses. The October evaluation's production run used Gemini Flash-Lite. The code default is Flash. The live setting is `GEMINI_MODEL` in Vercel. Do not guess; look.

**3. The verifier.** Plain TypeScript, no second model (`src/lib/coach/verify.ts`). Every plan, whoever wrote it, passes through it before it is saved or shown:

- the reply matches the JSON schema;
- every exercise id exists in our library, fits the user's equipment, and avoids the muscles named in their injuries;
- no exercise appears twice on one day; the plan has the number of days asked for;
- numbers are in range: sets 1 to 6, reps 1 to 30, rest 30 to 300 seconds, target RPE 6 to 9, 2 to 8 exercises a day.

A plan that fails is regenerated once with the problems listed. If it fails again, the user gets the rule-based plan. The model picks exercises by name from the list we give it; code maps names to ids; the verifier checks the ids. The model cannot name an exercise we do not have. This applies to model-written plans, which go live with #127 and a button on the plan screen; today's starter plan is rule-based and also runs the verifier.

**4. Guardrails.** Safety is code, not just prompt.

- A safety screen runs first on every message: a small safety model (Groq `openai/gpt-oss-safeguard-20b`) with our written policy, limited to 3 seconds, and it can only raise the response. Then a word list is the deterministic floor (D15).
- A crisis message gets a fixed reply naming 9-8-8 and 911. Distress wording gets a short check-in that also names 9-8-8. Chest pain, fainting or trouble breathing get a fixed stop-and-seek-care reply. Disordered eating gets the NEDIC helpline.
- A pain report stops the exercise and suggests a professional. A pain question gets safe programming guidance (D13). The coach never diagnoses and never names a dose.
- No nutrition advice. A nutrition question gets a short out-of-scope reply that points to a registered dietitian.
- Messages are capped at 1,000 characters. Only the last 12 messages of history go to the model. User text only ever goes in as the user message, never into the system prompt.
- Every reply is checked before it is shown. A reply that diagnoses or names a dose is replaced.

**5. Streaming (D10).** The reply is released a sentence at a time, and the reply check runs on everything so far before each sentence goes out. We chose this over token-by-token because a token stream could show a diagnosis before the check catches it. Cost: the first text arrives a little later. The other provider is tried only before the first text arrives.

**6. Limits and logging.**

- Chat limits: 5 messages a minute and 50 a day per user, taken before any model call (`src/app/coach/limits.ts`). The counter is in memory on each server instance; the count of saved messages in PostgreSQL is the backstop across instances.
- Plan requests: one a minute per account, stored on the user row (`User.lastCoachPlanRequestedAt`, `src/lib/auth/plan-rate-limit.ts`), so it holds across instances. This limit belongs to model-written plans, which go live with #127.
- Each model call writes one `CoachEvent` row with no prompt or reply text, so a bad plan or a slow demo can be traced to its call.

**How the coach measured.** Ten fixed profiles (different equipment, days, injuries). Round 2, 30 October: the production chain (Groq, then Gemini Flash-Lite) served a coach-written plan for 10 of 10 profiles and the verifier passed the first reply for 9 of 10. The ten replies are replayed through the verifier in CI on every pull request (`src/lib/coach/evalReplay.test.ts`) with no network or keys. **Limit:** this shows the plans are safe and well-formed. It does not show they are good programs. One run per profile; a prompt change needs a rerun.

**How it fails.** Providers' free tiers hit limits inside ten requests, which is why there are two providers and demo mode. On 21 Nov the live chat showed saved replies as unsaved because a cache refresh threw inside the stream after the save; found by reproducing it locally, fixed in #124.

### Cloudflare R2 for photos (D3)

- **What.** A private bucket reached through the S3 API with the AWS SDK. A photo's bytes live in R2; the database keeps only the key, the date, an optional weight and a note.
- **Why.** Photos are personal, so the bucket is private and the app signs short-lived links. R2's free tier is 10 GB of storage and has no egress fees (checked 6 Nov, see D3). We moved from DigitalOcean Spaces because Spaces has no free tier.
- **Limits.** Up to 50 MB can be picked; the browser shrinks to under 4 MB because Vercel rejects request bodies over 4.5 MB. At most 1,000 photos per account.
- **How it fails.** If the four R2 settings are missing or the token expires, uploads fail and the page shows an error; the rest of the app is unaffected. Pages that do not touch photos never read the R2 settings.

### Vercel deploy (D19)

- **What.** Vercel Hobby hosts the app, on Mohammad's account, because only the owner of a personal repository can import it. Neon Free hosts PostgreSQL, region Washington D.C., next to Vercel's default function region. Live site: https://fitness-coach-psi-olive.vercel.app.
- **Build.** `vercel.json` runs `scripts/vercel-build.ts`. On production and preview builds it checks that the pooled and direct database URLs point at the same Neon branch, runs `prisma migrate deploy`, seeds the exercise library (with no demo logins), then `next build`. A step that fails stops the build.
- **Why.** Both free, no server to run, a preview URL for every pull request, functions up to 300 seconds, enough for a streamed reply. We compared Render and Railway (D19).
- **How it fails.** Hobby is non-commercial. On 22 Nov the Vercel preview check failed on several open pull requests; the cause is not confirmed (Neon's free branch limit is the suspect). Production was not affected as far as checked.

### CI (GitHub Actions)

- **What.** On every pull request, a PostgreSQL 16 service runs and the pipeline does: install, apply migrations, format check, lint, type check, unit tests, integration tests against the real database, a production build through the same script Vercel uses, then Playwright browser tests. The file is `.github/workflows/ci.yml`.
- **Why.** The integration tests run Server Actions against real PostgreSQL, so a broken migration or constraint fails before merge. The build step catches deploy-script errors.
- **How it fails.** `main` is protected: a pull request, one approval and a green `check` are required. A flaky browser test can block a merge; we rerun once and file the flake.
- **Size.** 109 test files in the repository on 22 Nov: 93 unit, 8 integration and 8 browser specs.

## 4. Who built what

From the merged pull requests and the git history on `main` as of 22 Nov. 52 pull requests merged.

| Person   | Merged PRs | What                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nabeegh  | 30         | Foundation: schema, seed, CI, Prettier, ESLint (#17, #44). The coach: provider adapters (#30), the eval (#32, #55, #87), running and hybrid weeks (#45, #47, #54), guardrails (#48), call logging (#49), chat turn (#53), streaming (#56), chat screen (#96), demo mode (#99), RPE (#101), "Why this plan" (#88). Deploy config (#61). Root error state (#74). shadcn/ui (#77). Proposal section 2 (#35, #40). |
| Mohammad | 5          | Today's session (#39), body map (#70), exercise library with cues (#102), proposal motivation (#31), a chat tie-break fix (#115). Owns the Vercel project. Two open pull requests: joint-aware swaps (#121), pain traffic light (#122).                                                                                                                                                                        |
| Shubham  | 10         | Accounts, verified sign-in, tiers and Stripe test mode (#67, #68). Connecting the quiz and sessions to signed-in users (#83). Coach access: chat isolation (#105), tier guards and plan-request limits (#106, #107), user-scoped coach records (#108), guarding streamed chat (#119). Docker compose for local PostgreSQL (#27). Plan section (#36).                                                           |
| Farnaz   | 7          | Progress page and streak logic (#114, #82). Private photo storage (#109, #113). Profile photos (#110). Navigation bar, theme and body map in the session (#120). Proposal section 4 (#37).                                                                                                                                                                                                                     |

Non-merge commits on `main`: Nabeegh 252, Mohammad 33, Shubham 24, Farnaz 16. Do not quote those as workload. Nabeegh's count includes documentation, meeting notes and logs, and squash merges credit the commit to the pull request's author. The pull request list above is the better picture, and the README's "Who does what" table gives the intended split.

How to say it in one breath: "Mohammad built the quiz, session screen, body map and exercise library. Farnaz built progress, photos and navigation. Shubham built sign-in, tiers, Stripe test mode and coach access. Nabeegh built the schema and CI, the coach, and the deployment setup."

## 5. The course's Q&A topics

The instructor and TAs ask one main question and a short follow-up. The topics are from the presentation guidelines: architecture and technology choices; frontend and backend data flow and state; database; cloud storage and file handling; advanced feature design; trade-offs and limits; remaining work. Each answer has the two-sentence version first.

### A. Architecture and technology choices

**Q: Why this architecture and these technologies?**

**Say this.** One Next.js app in TypeScript does both screens and server logic, so there is no separate API to build and secure, and validation sits next to the database call. PostgreSQL through Prisma fits our relational data, and the AI sits behind one module with checks written in code.

**Evidence.**

- Decisions D1 to D22 in ARCHITECTURE.md, each with the option it beat. D1 compares React plus Express; the research is in RESEARCH.md section 2.
- Next.js 16, React 19, Tailwind 4, shadcn/ui on Base UI (D20), Prisma 7, Better Auth, Stripe, the AWS S3 client for R2 (`package.json`).
- Server Components read, Server Actions write, three route handlers for the places that need plain HTTP.

**Limit.** Tied to Next.js. A mobile client would need an API. Free-tier hosting is for the course, not for real users.

### B. Frontend and backend data flow and state

**Q: Walk me through one request. Where does state live?**

**Say this.** A tap on "Log set" calls a Server Action, which re-reads the signed-in user, validates the input, upserts the set in PostgreSQL through Prisma, and refreshes the page, which then reads what was stored. State lives in the database; the browser holds only what is on screen.

**Evidence.**

- `src/app/session/actions.ts` `logSet`: user check, ownership in the query, upsert on workout, exercise and set number, `revalidatePath("/session")`.
- `/session` is a Server Component marked `force-dynamic`.
- Small pieces of browser state (form fields, the rest timer, the open chat) use plain React state and `useActionState`. There is no global client store. The architecture doc lists Redux Toolkit as a planned shortcut. It was not adopted: the Server Component and Server Action pattern already keeps state on the server. If asked, say that plainly.
- The coach reply is the one place with a streamed response, through `/api/coach`.

**Limit.** Every set save is a round trip, and the page needs a connection. Showing an "unsaved, retry" state on the set form is planned, not built (issue #42).

### C. Database

**Q: How is PostgreSQL used, and why a relational database?**

**Say this.** The data is relational: a user has a profile and plans, a plan has days and exercises, a user has workouts and logged sets. PostgreSQL with Prisma gives typed queries, committed migrations and uniqueness rules that stop duplicate rows.

**Evidence.**

- 20 models in `prisma/schema.prisma`. The exercise library comes from the public-domain free-exercise-db dataset, seeded into PostgreSQL, with cues and common mistakes added for 30 curated exercises (`prisma/data/exercise-cues.json`).
- Integration tests run the Server Actions against a real PostgreSQL 16 in CI.
- The quiz writes profile and plan in one transaction.

**Limit.** The plan stores sets, reps and rest but not the target RPE (D17: the verifier checks it; storing it is a follow-up and waits on a migration). A few "only one of these" rules are in code until #89 merges.

### D. Cloud storage and file handling

**Q: How are photos stored and shown?**

**Say this.** The browser shrinks the photo, the server checks and resizes it to at most 1,600 pixels, stores it in a private Cloudflare R2 bucket and keeps only its key in PostgreSQL. The page shows it through a signed link that expires after 5 minutes.

**Evidence.**

- `src/lib/photos/limits.ts`, `shrink.ts`, `process.ts`; `src/lib/storage/r2.ts`; D3.
- The photo is tied to a user record: the `ProgressPhoto` row carries the user id and the storage key.
- Why shrink in the browser: Vercel rejects request bodies over 4.5 MB.

**Limit.** 1,000 photos per account; about 33 full accounts would fill R2's free tier. Fine for the course, to revisit for real users (D3).

### E. Advanced feature design

**Q: What are your advanced features, and how do they integrate?**

**Say this.** Two. Authentication and authorization with four access tiers checked on the server on every request, and an external AI API, the coach, behind checks written in code. Streamed replies, photo processing and Stripe test mode are extras.

**Evidence.**

- Feature 1: `src/lib/auth/access-policy.ts` `resolveAccess` and `requireTier`. The tier gates the coach route and the chat page.
- Feature 2: the coach reads the user's goal, level, equipment, avoided muscles and next planned session from PostgreSQL (not yet their logged sets), saves each exchange to the user's conversation. The tier decides who can chat.
- Integration: sign in, the quiz writes a plan, the session logs sets, the coach answers about that plan, progress reads the same sets.

**Limit.** The model-written plan on demand ("Personalize with the coach") is built and under review (#127). The button is not on the plan screen yet.

### F. Trade-offs and limits

**Q: What are the weak points?**

**Say this.** The coach's checks prove plans are safe and well-formed, not that they are good programs. And the app runs on free tiers, so rate limits, sleeping databases and in-memory counters are the real constraints.

**Evidence, one honest list.**

- Eval: 10 profiles, one run each; a prompt change needs a rerun.
- The chat limiter counts in memory per server instance; the database count is the backstop.
- Neon sleeps after about 5 idle minutes; the first request is slower.
- Providers' free tiers fail inside ten requests; mitigations are retry, second provider, rule-based fallback, demo mode.
- Suspected, not reproduced or tested: a double-tap "Could not save" message; the quiz can show default answers after a second save until #148 merges.
- No automatic weight progression. The deload rule (#93) is written and in review (#130), not on main, and has no screen.

### G. Remaining work

**Q: What will you finish by 6 December?**

**Say this.** Code complete on Sat 5 Dec: the "Personalize with the coach" button, the pain traffic light and joint-aware swaps if their reviews clear, the fatigue deload screen, then the report and the video on the 6th. If time runs short, personas (#80) and coach memory (#84) go first, then the swaps and pain light.

**Evidence.** [PLAN.md](PLAN.md) (dates), the team plan of 22 Nov in section 7 below, and the 17 Nov meeting notes. Features freeze on Mon 23 Nov and nothing new is shown after the 26th.

## 6. Fifteen likely follow-ups

**1. Why Groq first and Gemini second?** Groq's free tier allows more requests a day, needs no card, and answered about three times faster in the October eval (median 3.5 s against 9.9 s). Gemini's free tier may use prompts to improve Google's products. Gemini is the fallback so one provider's outage does not stop the coach (D4, D6).

**2. Why does the coach not just use ChatGPT?** A general model does not know this user's equipment, injuries or plan, and nothing checks its answer. Ours is grounded in the user's rows from PostgreSQL, and every sentence passes checks in code. Model-written plans, which use only library exercises and pass the verifier, go live with #127.

**3. Do you use RAG or a vector database?** No. The "retrieval" is the list of eligible exercises, filtered by the user's equipment and injuries, put in the prompt as names grouped by muscle (D7). On the full-gym profile that is about 694 exercises and 4,700 tokens, in the October eval. The user's own data is read straight from PostgreSQL.

**4. How do you stop prompt injection or a user changing the rules?** User text only ever goes in as the user message, never into the system prompt. The model's output is never executed: it can only name library exercises, and the verifier checks the ids. Reply text is checked before it is shown. A model-based safety screen with a written policy runs on every message first.

**5. How do you stop one user reading another's data?** Every Server Action and route re-reads the signed-in user and puts the user id into the database query. Tests send forged owner and workout ids and show they are ignored. Coach conversations are scoped to the user.

**6. How is the app secured against misuse of the chat?** Same-origin check on the route, a signed-in trial, pro or admin account, strict JSON with a 64 KB body cap, a 1,000-character message cap, 5 messages a minute and 50 a day, taken before any model call.

**7. Is payment real?** No. Stripe test mode, test cards, signed webhooks, each event stored once. There are no live keys.

**8. What happens when the trial ends?** The tier is recomputed from the stored end date on each request, so the user is back on free with no scheduled job. They keep their plan and logs; the coach tab is locked.

**9. What happens if two taps hit "Log set"?** The save is an upsert on workout, exercise and set number, so a repeat updates the same row. Suspected, not reproduced: for a new set, a second tap in flight may show a "Could not save" message. Two taps at once are not covered by tests today. PR #128 adds tests that prove one row remains; PR #89 adds database rules.

**10. How do you test the AI, which is not deterministic?** Three ways. Unit tests with saved replies. Tests at the provider boundary with timeouts, bad JSON and rate limits faked on purpose. A fixed-profile evaluation, whose replies are replayed in CI on every pull request. Limit: this tests safety and form, not quality.

**11. What does the plan actually contain? Does it progress my weights?** Sets, reps, rest and exercise order per day. You log the weight. There is no automatic progression yet. A rule that proposes a lighter week when two fatigue signals agree is written (#130, decision D21); the screen to accept it is not.

**12. How does running work?** Quiz mode "Running" or "Both" builds a hybrid week by rule: strength and run days split by goal and days a week, at most five run days. A run week is capped at 10% over last week's logged distance, never below 1 km (D8, D9; `verifyRunning.ts`).

**13. How does it scale?** Not designed past course scale. It runs on free tiers. The in-memory chat limiter is per server instance; the plan-request limit is stored in the database. Photos are capped per account. Say what you would change: a shared counter store, a paid database plan, a storage plan.

**14. Why Server Actions and not a REST API?** Nothing outside the app calls the backend. Actions are typed, have CSRF protection built in, and keep validation next to the write. Route handlers are used only for the webhook, the auth endpoint and the streamed reply (D1). The cost: a mobile app later needs an API.

**15. What would you do with more time?** In order: a "Personalize with the coach" button on the plan screen, an unsaved-retry state on set logging (#42), the deload screen (#129), automatic weight suggestions, stored target RPE, coach memory (#84), and a shared rate-limit store.

## 7. Advanced features and the plan to 6 December

**Built and shown.**

- **Advanced feature 1: authentication and authorization.** Verified email sign-in, four tiers, server-side checks on every protected request, Stripe test-mode subscriptions with signed webhooks. Source: `src/lib/auth`, `src/lib/billing`.
- **Advanced feature 2: an external API, the coach.** Two providers with fallback, guardrails, streamed replies and a per-call log are live. The verifier runs on the starter plan today and on model-written plans once #127 merges. Source: `src/lib/coach`, `src/app/api/coach/route.ts`.
- **Extras on main.** Photo processing (resize, strip metadata, signed URLs), a progress page, the body map, a "Why this plan" panel.

**The plan.** Course dates: written introduction Wed 25 Nov; slides Thu 26 Nov; presentations Fri 27 Nov and Fri 4 Dec; final deliverable Sun 6 Dec, 11:59 PM.

| Date           | What                                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mon 23 Nov     | Feature freeze for what is shown on the 27th.                                                                                                                      |
| Thu 26 Nov     | Slides uploaded. Only work finished by now may be shown.                                                                                                           |
| Mon 30 Nov     | Decide go or cut: joint-aware swaps and the pain traffic light (#121, #122) if reviews are not clear; coach personas (#80) only if everything else is merged.      |
| By Sat 5 Dec   | Code complete: "Personalize with the coach" button (#127 plus a button on the plan screen), fatigue deload screen (#129), whatever of #121 and #122 clears review. |
| Sat 5 to Sun 6 | Report, README as the final report, AI record, video.                                                                                                              |

**Not built: coach personas (#80).** An idea for a third advanced feature: three coaching styles that change wording only. It is not started. If asked: "It is a stretch goal, behind everything above. We decide on 30 November whether to build it. If we do, the checks do not change; only the wording does."

## 8. Glossary

Plain meanings, for saying out loud.

- **App Router.** Next.js's way of making pages from folders in `src/app`. A page there is a Server Component by default.
- **Server Component.** A page piece that runs only on the server and can read the database directly.
- **Server Action.** A function marked `"use server"` that a form calls. It runs on the server. Next.js adds CSRF protection.
- **Route handler.** A plain HTTP endpoint in `src/app/api`. We use three: auth, Stripe webhook, coach stream.
- **Prisma.** The library that turns our TypeScript calls into SQL and manages migrations.
- **Migration.** A saved database change, applied in order. Ours are in `prisma/migrations`.
- **Neon.** The hosted PostgreSQL. Free tier; sleeps after about 5 idle minutes.
- **Upsert.** "Update the row if it exists, create it if not." How a set is saved.
- **Transaction.** A group of writes that all happen or none do. The quiz uses one.
- **Better Auth.** The sign-in library. Handles accounts, sessions, verification email, password reset.
- **Tier.** FREE, TRIAL, PRO or ADMIN. Computed on every request from the stored tier, trial end and billing record.
- **Webhook.** Stripe calling our server to say something happened, such as a payment.
- **Idempotent.** Safe to repeat. Our webhook stores each Stripe event id once so a retry changes nothing.
- **R2.** Cloudflare's file storage with an S3-compatible API. Ours is private.
- **Signed URL.** A temporary link to a private file. Ours expire after 5 minutes.
- **sharp.** The image library that resizes and converts photos on the server.
- **Groq and Gemini.** The two model providers. Groq leads; Gemini is the fallback.
- **Verifier.** Plain code that checks a plan against the schema, the library, the user's equipment and injuries, and number ranges.
- **Guardrail.** A rule in code that checks what the user types or what the coach says, such as pain, crisis or off-topic wording.
- **Fallback.** What happens when the first choice fails: retry, then the other provider, then a rule-based plan.
- **Demo mode.** A setting (`COACH_DEMO_MODE`) that cuts each model call to 8 seconds and skips retry waits, so a failure reaches the fallback fast.
- **RPE.** Rate of perceived exertion, here on the reps-in-reserve scale: 9 means one rep left, 7 means three left. The coach targets 6 to 9.
- **Deload.** A planned lighter week. The rule (D21, pull request #130, not on main yet) proposes one only when two fatigue signals agree.
- **Eval.** The test of the coach on ten fixed profiles. Replayed in CI.
- **CI.** The automatic checks GitHub runs on every pull request.
- **Integration test.** A test that runs real code against a real database. Ours run against PostgreSQL 16 in CI.
- **E2E test.** A browser test that clicks through the app. Ours use Playwright.
- **Preview deployment.** A temporary copy of the app Vercel makes for each pull request, with its own database branch.
