# AI session log

Required by the ECE1724 project handout: representative AI interactions, what was asked, what came back, and what the team did with it. Each of us appends our own entries.

## Nabeegh

### 23 October 2026, tooling on the skeleton (issue #1)

**Asked:** how to add Prettier to the Next.js ESLint flat config without the two fighting over formatting, and what a minimal GitHub Actions workflow for a Next.js app looks like.

**Got:** the Next.js ESLint docs recommend `eslint-config-prettier` added last in `extends`; `prettier-plugin-tailwindcss` needs `tailwindStylesheet` pointed at the CSS entry point under Tailwind v4 because there is no `tailwind.config.js`; a workflow with `npm ci` then format check, lint, typecheck and build.

**Did with it:** wrote `prettier.config.mjs`, `.prettierignore`, the `extends` change and the npm scripts myself; ran all four checks locally before committing; verified the `extends` order against the Next.js docs page rather than taking it on trust. The lint run is slow on my machine (WSL on a Windows mount), so CI is the gate.

### 23 October 2026, first Prisma schema and seed (issue #2)

**Before asking:** I sketched the tables from `docs/ARCHITECTURE.md`: profile and quiz answers, an exercise library the coach picks from by id, plan to plan day to exercise slot, workouts and logged sets, coach conversations scoped to the user, progress photos stored as a bucket key only, and the four access tiers as an enum. Open questions I had: whether to use string ids so Better Auth's adapter fits later, and where Prisma 7 expects the seed command.

**Asked:** whether the lecture's Prisma 7 setup (`prisma7.config.ts`, `prisma-client` generator, `@prisma/adapter-pg`) carries over to Next.js unchanged, how to keep one client across hot reloads, and whether a `postinstall` is the usual way to regenerate the client in CI.

**Got:** the setup carries over; `prisma init` produces the same files as Lecture 3 p53 to p56; in Prisma 7 the seed command lives under `migrations.seed` in the config file, not `package.json` (the CLI said so when I ran `prisma db seed`); a `globalThis` guard for the client in development; `postinstall: prisma generate` so a clean `npm ci` has the client before typecheck.

**Did with it:** wrote the schema and seed myself, ran the init migration against a local PostgreSQL, seeded 876 exercises from free-exercise-db plus a demo user, ran the seed twice to confirm upserts make it idempotent, then deleted the generated client and ran a clean install to confirm typecheck still passes.

### 23 October 2026, plan schema and verifier (issue #11, first slice)

**Before asking:** the architecture doc already lists the verifier's rules (ids exist, equipment and injuries, ranges, no duplicate on a day). I decided the coaching ranges should live in code as constants, not as database constraints, because they are coaching decisions we will tune. I wanted all problems reported at once so a regeneration prompt can list them, the same reason A2 reports every validation error together.

**Asked:** whether one Zod schema can serve the parse step, the TypeScript types and the AI SDK's structured output later, and which Vitest version fits the scaffold's pinned `@types/node`.

**Got:** yes, `z.infer` gives the types from the same schema; Vitest 5 needs newer Node types than the scaffold pins, Vitest 3 fits.

**Did with it:** wrote the schema, the verifier and six tests covering each rule, including one that checks two problems are reported together; added `npm test` to CI.

### 23 October 2026, plan generation with retry and fallback (issue #11)

**Before asking:** my plan was ask the model, run the verifier, and if it fails, send the verifier's problems back once before giving up, because a model fixes a listed fault more reliably than a vague "try again". If the second try fails too, the user still needs a plan, so a rule-based split from our own library. I wanted the model call injected as a function so the logic is testable with no API key.

**Asked:** how to type a mocked async function in Vitest so `mock.calls` is typed, and whether a rule-based fallback should run through the same verifier.

**Got:** `vi.fn<PlanModel>()` keeps the call types; yes, run the fallback through the verifier in a test so it can never ship a plan the coach would be rejected for.

**Did with it:** wrote `generatePlan.ts`, `defaultPlan.ts` and three tests (pass first time, retry with the problems in the prompt, fallback that passes the verifier). Nine tests pass in total.

### 27 October 2026, provider research before meeting 2 (issues #7, #22)

**Before asking:** the architecture doc said Groq first, Gemini as fallback, on free-tier limits and data use. I wanted that checked against current pricing pages and against any evidence that an open-weight model is good enough for short structured output, so the meeting could decide on facts.

**Asked:** what each provider's free tier allows today, and whether published results compare open-weight models with the best closed ones on short structured judgements.

**Got:** Groq's free tier at about 1,000 requests a day on its large models with no card; Gemini's free tier near 20 requests a day on Flash with prompts usable to improve Google's products; a 2026 paper (Jiang and Fowler) where Llama 3.1 70B graded code explanations as well as the best model tested.

**Did with it:** wrote the comparison into #22 and the meeting notes; the team agreed to test both rather than decide on the research. The Llama result was already stale by 30 October (Groq no longer serves Llama), which is why the test, not the citation, decides.

### 30 October 2026, provider adapters and the first head-to-head (issues #7, #11, #19)

**Before asking:** the plan logic takes the model as a function, so the adapters were two fetch calls behind one type, chosen by an environment variable. I wrote the comparison criteria into `docs/COACH_EVAL.md` before running anything: first-reply verifier pass rate first, then retries, fallbacks, latency, errors, and the rule that Groq stays unless Gemini is clearly better.

**Asked:** the request shapes for Groq's JSON mode and Gemini's JSON response type; how a Vitest test mocks `fetch` so CI runs with no key; how to read a thinking model's reply when it returns thought parts first.

**Got:** `response_format: {type: "json_object"}` for Groq, which needs the word JSON in the prompt; `generationConfig.responseMimeType` for Gemini; `vi.stubGlobal("fetch", ...)` with a `Response` per call; skip parts flagged `thought`.

**Did with it:** wrote `providers.ts` and nine mocked-fetch tests, then ran ten fixed profiles on each provider. Both passed the verifier on every reply; every failure was the provider refusing the call (Groq 429, Gemini 503). The AI had suggested capping the exercise list at six per muscle to fit Groq's token limit; I ran with that cap, then rejected it in round 2 because the coach should see every exercise the user can do.

### 30 October 2026, retry, provider fallback and the full library (issues #7, #11, #19)

**Before asking:** three things were missing after round 1: a wait-and-retry on rate limits and outages, a switch to the other provider when the first is down, and the whole library in the prompt instead of a capped list. My rule for the retry: only transport errors are retried, and only when the provider's own wait is short; a bad reply goes back to the plan logic, which already retries once with the problems listed.

**Asked:** what Google and Groq recommend for 429 and 503; what headers carry the wait; how many tokens the full list costs in different formats.

**Got:** both recommend exponential backoff with jitter on 429 and 5xx and no retry on 400-class errors; Gemini puts `retryDelay` in the 429 body and Groq sends `x-ratelimit-reset-tokens` rather than `Retry-After` on a tokens-per-minute limit (found by reading the headers, not from the AI, which had assumed `Retry-After`); names grouped by muscle cost about 40% fewer tokens than one `id (muscles)` line per exercise.

**Did with it:** wrote `withRetry` and `withFallback` with fourteen more tests, then reran the eval. Round 2 found three real faults the AI's first version had not predicted: the model returns near misses of library names ("Standing Calf Raise" for "Standing Calf Raises"), copies the group label into the name, and writes a plank as 60 reps. Each got a code or prompt fix and a test, and the production chain then served 10 of 10 plans with no rule-based fallback while absorbing nine Groq rate limits. Gemini 3.5 Flash's free tier ran out at 20 requests during the run, so the fallback is Flash-Lite. Results and the trade-offs table are in `docs/COACH_EVAL.md`.

### 3 November 2026, running weeks, hybrid split, guardrails, logging and chat (issues #34, #41, #43, #46, #11)

**Before asking:** I set the rules the code had to follow. Runners keep strength days for injury prevention. A strength or muscle goal leans to strength days, and fat loss or a race leans to runs. A week grows at most 10% over last week's logged distance. Pain, not soreness, stops an exercise, and the coach never diagnoses. Every model call leaves a record we can read back for the final report.

**Asked:** for help structuring those rules as small TypeScript modules behind the existing verifier, and for edge cases the tests should cover.

**Got:** a module layout that keeps each rule in its own file, and test ideas, including a loop over every history from 1 to 60 km and every week from 1 to 7 days, which caught two weeks that went over the cap.

**Did with it:** reviewed each module against the rules above and ran the tests, typecheck and lint before each pull request (#45, #47, #48, #49, #53, #54). Saving a week once to a real PostgreSQL (PGlite with all migrations) showed that in a two- or three-run week the long run came out shorter than the easy run; the unit tests had passed because none checked it. I changed the shares and added a test that the long run is the longest for two to five run days. I checked the Groq free-tier limits cited in Section 2 against Groq's own rate-limits page.

### 6 November 2026, README refresh (issues #2, #11, #13, #14, #15, #16, #62)

**Before asking:** the README still described the project as it was before the code landed: proposal drafting, no coach evaluation, an empty repository layout. I decided which sections to replace (top, owners, stack, layout), which to keep as written (team, local development, how we work), and that every line had to match what is on `main` today.

**Asked:** for a draft of the replaced sections and two new local-development subsections, coach keys and checks.

**Got:** a draft README with a dated status line, an owners table, the stack and layout, and the two subsections.

**Did with it:** checked every line against `main` before committing. Three lines were wrong and I changed them. The draft said payments were out of scope, but Stripe test mode is a stretch in #14. It named Cloudflare R2, but the storage decision on `main` does not. It said the app plans without any key, but the code requires the first provider's key. I also corrected the status line: sign-in is on its branch, not in an open pull request.

### 6 November 2026, photo storage on Cloudflare R2 and settled questions (issues #16, #7, #12, #8)

**Before asking:** the architecture doc named DigitalOcean Spaces for progress photos, but Spaces has no free tier, and Farnaz proposed R2 in #16. I wanted the decision changed only if the pricing pages backed it, and the research doc's open questions closed where an issue had already settled them.

**Asked:** what R2's and Spaces' pricing pages say today, and whether enabling R2 needs a payment method.

**Got:** R2's free tier of 10 GB-month of Standard storage, 1 million Class A and 10 million Class B operations a month and free egress; Spaces at $5 a month with no free tier; and a teammate's report that the checkout step enabling R2 may ask for a payment method.

**Did with it:** rechecked the R2 page on 6 November before committing, changed D3 and the diagram node to R2, and added a short storage section to the research doc. R2's get-started page shows the checkout step but does not mention a payment method, so the doc attributes that to the teammate's report. The README keeps its generic "S3-compatible bucket" wording, which stays true. I also closed the research doc's stale questions against the issues that settled them and pointed the plan's eval link at `main`.

### 6 November 2026, crisis and red-flag guardrails (issue #43)

**Before asking:** I set both rules and wrote both replies myself. Any message about not wanting to be alive, suicide, self-harm or ending one's life gets a fixed reply pointing to 9-8-8 (call or text, any time) and 911, with no model call, before every other rule; I checked 9-8-8 on the Public Health Agency of Canada and CRTC pages. Chest pain or tightness, fainting, severe shortness of breath or an irregular heartbeat during exercise gets "stop exercising now" and medical attention, checked next, before pain. Effort talk ("this workout is killing me", "I'm dying after that run") and soreness ("my chest is sore from bench") must pass.

**Asked:** for the matching patterns and for test phrases in both directions.

**Got:** patterns and phrases. Running them showed that "I don't want to hurt myself on heavy deadlifts" was read as a pain report, because "don't" was missing from the words that cancel a pain phrase, and that "this workout is killing me" was read as pain.

**Did with it:** wrote the failing tests first, then the patterns, and added "don't" to the negations and narrowed "killing me" to a body part ("my shoulder is killing me"). An independent review checked the patterns and the 9-8-8 details before the push.
