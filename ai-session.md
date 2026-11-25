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

### 5 November 2026, hosting choice and deploy config (issue #57)

**Before asking:** D5 already said we deploy for the demo. I set the conditions: free tiers with no card, a hosted PostgreSQL that does not expire before the presentation, `prisma migrate deploy` on release rather than by hand, every variable in `.env.example` with no secrets committed, and no accounts created until the config was reviewed. The course accepts a local demo, so this is for integration and the pilot.

**Asked:** to compare Vercel with Neon, Railway and Render against each provider's own pricing and docs pages as of today, and how Prisma 7 should connect to Neon from Vercel.

**Got:** Render's free PostgreSQL is deleted 30 days after creation and its web service sleeps after 15 minutes; Railway gives a 30-day $5 trial, then $1 a month; Vercel Hobby is free with a 300-second function limit and Neon Free needs no card. Neon's Prisma guide uses the pooled string for the app and a direct string for the CLI. A suggestion to migrate only on production builds, so a pull request preview never applies an unmerged migration to the shared database.

**Did with it:** recorded the choice and the options it beat as D19 with the sources and the date checked; wrote the two rules (which URL the CLI uses, which steps a build runs) as a small module with six tests written first and seen failing; added `vercel.json`, the build script, the `.env.example` entry and the README Deploy steps. CI already runs `npm run build`. Creating the accounts, seeding Neon and checking the demo path on the live URL are the steps left to me.

### 5 November 2026, deploy review fixes (issue #57, PR #61)

**Before asking:** an independent review of #61 found that previews would share the production database. I listed the fixes I wanted: a separate Neon branch for previews with Preview-scoped variables, a connection timeout for a database waking from suspend, the Neon region next to Vercel's functions, the release script run in CI, a pinned Node version, and a note on who owns the Vercel project.

**Asked:** to check each fix against Prisma's Vercel guide, Neon's Prisma guide and Vercel's Git, function and Node.js docs, and to apply them.

**Got:** Prisma's guide says a pull request with a migration would change the production schema and recommends a second database scoped to Preview; Neon's guide gives `connect_timeout=15` for P1001 on wake; Vercel's default function region is `iad1`; Node 22.x is still offered; Vercel's Hobby commit-author check applies to private repositories in organizations, not to our public repository.

**Did with it:** updated the README Deploy steps and the D19 cost, switched CI from `npm run build` to `scripts/vercel-build.ts` (so the first 5 November entry's "CI already runs `npm run build`" no longer holds), and added `engines` to `package.json`. A second independent review then found that Vercel lets only the owner of a personal-account repository import it, so Mohammad creates the Vercel project; that previews with their own database should migrate too, which I changed test first; and that `npx` should not fetch missing binaries. I checked each against Vercel's and Neon's docs, fixed them, and reran lint, typecheck, tests and the format check.

### 6 November 2026, Section 2 trim for the final proposal (issues #4, #13)

**Before asking:** the four sections came to about 2,280 words against the 2,000-word cap, and Section 2 (mine) was the longest. I set the rule for the cut: every objective, the diagram, the entity table, the decision and failure tables and both advanced features stay; only repetition and wording go. The technologies table repeated 2.2 and 2.3, so it could become one sentence.

**Asked:** for tighter wording of each paragraph and table row under that rule, and a word count that does not treat table pipes as words.

**Got:** shorter rows and sentences, and a count of the whole proposal at about 1,990 words with pipes and table rules removed.

**Did with it:** kept the cuts that only removed words and put back three that dropped substance (that each record belongs to a user, the activity-level field, and runs as well as sets in the logging row). Brought in the Section 2 changes already on `main` from the 3 November design review (Better Auth citation, pilot on a deployed preview, sentence-at-a-time streaming), and changed the CI replay of ten coach profiles to future tense, since it is still in review.

### 6 November 2026, cross-section fixes on the final proposal (issues #4, #13)

**Before asking:** I listed what a grader would trip on when reading the four sections as one file: relative links that are dead outside the repository, Section 3 giving dates without naming its stages, Section 1's subscription model against Section 4's note that payments are out of scope, and three citation formats where the instructor asked for one. My rule: one commit per section, owner named, no rewording beyond the listed fix, and every word added offset in my own Section 2.

**Asked:** for the smallest wording for each fix, one merged APA reference list, and a recount with references included.

**Got:** absolute GitHub links, a one-sentence list of the four stages, a one-clause fix in Section 1, and a merged list of five references.

**Did with it:** checked every link target on `main` and both journal DOIs against Crossref before committing. The merged list saved fewer words than expected and the stages sentence pushed the total to 2,015, so I cut Section 2's demo-path sentence, which restated Section 3's core path and freeze date, and shortened the Figure 1 caption to the dashed lines only. After an independent review I also made three Section 2 claims match the code: the model picks by name from our library, the per-call log is planned, and only the strength part of the schema is on `main`. The proposal ends at about 1,990 words.

### 6 November 2026, Stripe scope in the proposal (issues #13, #14)

**Before asking:** I traced where "payments are out of scope" came from. It entered my own Section 2 during a word trim on 3 November, Section 4 said the same that day, and my Section 1 fix earlier on 6 November followed it; no meeting decided it. The 27 October meeting kept Stripe off the core demo path, to be shown if ready by the freeze, and #14 still includes Stripe test mode. I fixed the four tiers first (free: quiz, rule-based plan, logging; trial: coach until the trial ends; pro: coach, set by an admin or by Stripe test mode if built; admin: the library) and checked the architecture doc already agreed.

**Asked:** for wording that restores Stripe as a stretch in Sections 1 and 2 without adding to the word count.

**Got:** the two sentences, and cuts elsewhere in Section 2 that repeat Section 3 or the failure table.

**Did with it:** kept the edits to my section and one clause in Section 1, each in its own commit with the meeting cited. The proposal stays at about 1,990 words. Section 4 still says Stripe payments moved out of scope; I left the wording to its author and raised it on the final-proposal issue. An independent review then caught that the trial tier had no description, so the tier line now names what each tier gets.

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

**Did with it:** ran the new tests against the old code first (20 failed), then wrote the patterns, added "don't" to the negations and narrowed "killing me" to a body part ("my shoulder is killing me").

An independent review then confirmed the 9-8-8 details on the CRTC, Public Health Agency of Canada and 988.ca pages, and found the first patterns too narrow. Missed were "I want to die", "I've been cutting myself", "I took too many pills on purpose" (which got the no-medication reply), "my chest hurts during runs", "I collapsed after the set" and every message typed with a phone's curly apostrophe. It also found training talk caught by mistake: "suicide sprints", "I want to end it with planks", "cut myself some slack", "faint praise". Each became a test, failing first, before I widened or narrowed the patterns. Any mention of shortness of breath counts as a red flag, which is on the safe side of my "severe".

### 6 November 2026, review before merging the coach pull requests (issues #11, #19, #34, #41, #43, #46)

**Before asking:** my rule for my own pull requests is three days for the team to review, then an independent review of each diff against its issue, the tests and `docs/ENGINEERING_PRACTICES.md` before merging. I decided which findings block a merge: a safety rule that can be bypassed, a promise in the code or the issue that the code does not keep, and data the database can get wrong.

**Asked:** for a review of each pull request by a reviewer that had not seen the work, with inputs that try to break each rule, and for the edge cases to turn into tests.

**Got:** six blocking findings, each with a reproducing input. A pain report was cancelled by a negated phrase elsewhere in the message ("no pain on the warm-up but my knee hurts"), and a pain report with a medication question got the no-diagnosis reply instead of the stop. Typed injury text went into the system prompt unfenced. A user who logged under 1 km got a rule-based running week its own verifier rejects. Three saves at once left three active plans on PostgreSQL. Log records did not name the provider and model, which #41 asks for.

**Did with it:** wrote a failing test for each finding, then the fix, on its own branch (#48, #53, #45, #54, #49). Ran the concurrent-save case against PostgreSQL 16 in Docker before and after the row lock: three active plans without it, one with it. Checked the claim about which eval run hit which matching fault against the result files, and corrected `docs/COACH_EVAL.md` (#55): the copied group label was in run 3 and the calf-raise near miss in run 2b; run 1's own faults were names not in the library and a plank written as 60 reps. Findings that do not block a merge are listed on each pull request.

**Later the same day:** from my literature scan I added two things before #48 merges. I chose the triggers and the reply rules: fixed replies with no model call, narrow enough that a fat-loss goal never trips them, NEDIC for eating concerns, and the plan left unchanged on a guilt or self-worth message. I used AI to check the two papers and the NEDIC helpline against their own pages, and to suggest test phrases. The suggested phrases included hunger ("I'm starving after my run"), which my first pattern wrongly caught. A second independent review then tried both directions: it found ordinary messages the patterns caught ("disgusting weather for a run", "I'm starving to death after my long run") and real disclosures they missed ("I made myself sick after dinner", "I throw up after I eat", "my knee never stops hurting"). Each became a test before I changed the patterns, and an eating disclosure that mentions pain now gets the eating reply rather than the stop. Plans also get a one-line note to see a professional first when the profile lists an injury or condition (#54), computed from the profile so it changes when the profile does.

### 6 November 2026, Google Health Coach in Section 1 (issue #13)

**Before asking:** Google's coach is the closest new competitor, so the motivation section had to name it, with a primary source for each claim and no growth in the word count.

**Asked:** what Google's own pages say about Google Health Coach, and for an independent check of every claim and price in Section 1.

**Got:** Google's support article: the coach is built with Gemini, gives personalized weekly fitness plans, and needs a Fitbit or Pixel Watch. The check confirmed the two studies and the prices, and found one wrong phrase: the adherence review lists personal characteristics, not individual circumstances.

**Did with it:** added Google to the competitor sentence and the reference list, fixed the phrase and a dangling "Their", and shortened the last paragraph so the proposal stays at 2,000 words. The store page gave no readable text, so the citation is the support article.

### 6 November 2026, Future's price in Section 1 (issue #13)

**Before asking:** the review of Section 1 found Future's $149 figure only in an old Future blog post and a competitor's review. I wanted the price taken from Future's own site.

**Asked:** what Future's homepage states as its price today.

**Got:** "$50 first month, then $199/month", with no $149 or annual rate on the page.

**Did with it:** changed the range to $199 per month in Section 1 and the combined file; the word count did not change.

### 6 November 2026, final proposal pass (issue #13)

**Before asking:** three teammates had read the proposal. Mohammad approved, Farnaz left five suggestions, and Shubham expanded his responsibilities and changed how pro access is described. I kept his added responsibilities, restored the agreed pro tier (set by an admin, or by Stripe test mode if built), took Farnaz's points, and set one rule for the cuts: only my Section 2, never a fact.

**Asked:** for the SensAI and Future prices from their own pages, a check of the chat code's fallback, and an independent review of the whole proposal against its sources, the handout and the 2,000-word cap.

**Got:** SensAI's App Store listing at $6.99 a month and Future's site at $199 a month; the chat code shows a fixed message when the model is down, not a cached reply; and four review findings: Groq sends a token-wait header as well as Retry-After, Section 3's review rule contradicted the 3 November decision, the SensAI title was off, and Section 2 no longer said where verified plans go.

**Did with it:** made each change in its own commit naming the section's owner, cut repetition in Section 2 to stay under the cap, and rebuilt the combined file from the sections. The proposal ends at 1,985 words.

### 6 November 2026, crisis screening in three layers (issue #43)

**Before asking:** two independent reviews of the guardrails found crisis and cardiac wordings the word list missed, and common gym exaggeration getting the full crisis reply. I decided a longer word list would not catch up, and set the design: keep the word list as the deterministic floor; add a short check-in that still names 9-8-8 for exaggeration in training talk ("I'm gonna die on this run") and for distress with no training context; and run a model safety check first that can only raise the response, never lower it. Tests first, from every phrasing the reviews found.

**Asked:** for Groq's current safety models and their status, the tests from the review phrasings, the three layers as separate small modules, and a fresh independent review before anything merges.

**Got:** Groq serves `openai/gpt-oss-safeguard-20b` for bring-your-own-policy moderation, in preview (Groq content-moderation and model pages, 6 Nov); 67 new word-list cases and two new test files that failed first; `distress.ts` (check-in), `safetyScreen.ts` (layers, 3-second limit, model failure falls back to the word list) and `safetyModel.ts` (policy in Groq's recommended four sections, JSON output).

**Did with it:** checked that every earlier case still passes, wrote the decision as D15 in `docs/ARCHITECTURE.md` with the option it beat, and kept the check-in wording short with 9-8-8 and 911 in it. Nothing in the app calls the screen yet; the chat code (#53) does next. A second fresh review found more missed crisis and cardiac wordings, a distress reading from the model replacing the eating-support and pain-stop replies, and crisis messages softened to the check-in by any gym word. I kept the design and tightened it: a reply that already gives specific help now outranks a distress reading; exaggeration counts only when tied to the session and nothing states intent; any message with crisis words that would get the off-topic redirect gets the check-in; and every new wording became a test that failed first (64).

### 8 November 2026, indexes from the session queries (issue #76)

**Before asking:** the design review listed six indexes. I wanted each one tied to a query that runs on `main` today, not added in case it is needed, and a before-and-after query plan on realistic row counts, because on the seeded demo data every table is small enough that Postgres scans it whatever indexes exist.

**Asked:** to list every Prisma read on `main` with its filter and sort, to capture the SQL Prisma actually sends for the session queries, and to check the current Prisma 7 and PostgreSQL docs on `@@index`, migrations and foreign-key indexing.

**Got:** nine reads on `Plan` and `Workout` in `src/app/session/` (six in `actions.ts`, three in `page.tsx`), all sequential scans at 5,000 users and 100,000 workouts; no query on `main` touches `Conversation` or `ProgressPhoto`, and `SetLog.exerciseId` and `PlanExercise.exerciseId` are only reached through unique constraints that already lead with `workoutId` or `planDayId`; the PostgreSQL 16 docs confirm a foreign key gets no index of its own.

**Did with it:** added the two composite indexes the queries justify in one migration, kept the other four out until a pull request adds a query that needs them, and recorded `EXPLAIN ANALYZE` before and after in the pull request. Every session query now reads through an index; the sorts left run on one to four rows.

### 10 November 2026, one active plan, one open workout and range checks in the database (issue #76)

**Before asking:** my schema audit found that two writers deactivate the old plan and insert a new one under different locks, that Start can open two workouts on one plan, and that Postgres accepted an RPE of 99 and a negative weight. I decided the rules belong in the database as constraints, not in more locks in the code, and that each fix needed a test that fails on the current schema first, run against a real PostgreSQL 16.

**Asked:** for the current Prisma 7 syntax for partial unique indexes and whether Prisma can declare CHECK constraints, for a review of the migrations against migration-safety rules, for the query plans of the session queries after the new indexes, and for a test that reproduces each race deterministically instead of by luck. The targeted help came from these tools: Context7 and the Firecrawl connector for the Prisma pages on `partialIndexes` and the database-features matrix and the PostgreSQL page on deadlocks; the `opinionated-prisma` schema-design, indexing, migration-safety and transactions skills; the `coding-skills` isolation-anomalies and expand-contract skills; the `agentic-sdlc` testing-vitest skill; the `backend-design` review-migration and explain-this-query skills and its schema-reviewer agent; and the `pr-review-toolkit` review (code, tests, comments and silent failures) as the independent check.

**Got:** `where` on `@@unique` behind the `partialIndexes` Preview, with a type-checked `{ finishedAt: null }` form; CHECK is "Not yet" in the Prisma schema and Migrate, so it needs a hand-written migration. The first race test passed on the current schema because the quiz's Profile insert locked the User row; with an existing Profile it failed in two different ways depending on which save ran first: two active plans when the coach save ran first, and a deadlock that aborted the coach save when the quiz save ran first.

**Did with it:** added a data migration that keeps the newest active plan and open workout, the two partial unique indexes and two foreign-key indexes, and fifteen CHECK constraints on my tables, leaving the workout's running columns to their owner. I changed the plan for `saveWeek`: it can never see the unique violation, because it holds the User row every plan insert needs, so it retries once on the deadlock abort instead. The reviews then showed that PostgreSQL does not promise which side a deadlock aborts, so I pinned each outcome in its own test and reworded the comments; that a deleted row could pass my first dedupe check, which I fixed and showed failing on the earlier migration; and that a workout with only notes would have been deleted, which it no longer is. Of the seven session queries from #78, Q1 and Q7 now read through the active-plan index and Q2 and Q5 through the open-workout index; every query still reads through an index in under 0.3 ms on the #78 test data.

### 8 November 2026, shadcn/ui in the foundation (issue #75)

**Before asking:** the course requires shadcn/ui or a similar library, and `main` had none. I decided to set it up once in the foundation with the same choices as my Assignment 4 (Base UI, Nova preset), so the project and the assignment follow one convention, and to move only the root page onto the components so no teammate's screen changes under them.

**Asked:** what the current shadcn CLI offers for an existing Next.js 16 and Tailwind 4 app, what `init` changes, and whether any of it alters the existing screens.

**Got:** CLI 4.23.0 with `--base` (Base UI, Radix or React Aria) and `--preset`, whose default is base-nova; `init` wrote `components.json`, `src/lib/utils.ts` and the theme tokens in `globals.css`, and pulled in shadcn's own `cn` package in place of `clsx` and `tailwind-merge`. Two lines needed attention: a font variable that referred to itself, and a global focus-outline colour that would restyle the teammates' buttons and links.

**Did with it:** checked the `cn` package's maintainer and repository before keeping it, fixed the font variable, left the outline colour out, and kept the app's background, foreground and primary colours so existing screens look the same; every border on those screens already names its colour, so the new default border colour does not reach them. Wrote the root page test first and saw it fail, then moved the page onto Card and `buttonVariants()` on the link, as in Lecture 8. Added a Vitest config so tests resolve the `@/` alias. Recorded the version and sources in `docs/RESEARCH.md` and decision D20 in `docs/ARCHITECTURE.md`. An independent review before the pull request found the link carried two conflicting paddings (now merged with `cn()`), a focus ring below 3:1 contrast (the ring now uses the ink colour), the CLI installed as a production dependency (moved to dev, which clears six audit advisories), and three doc claims stated more broadly than their sources; each was fixed, and the padding fix has a test that failed first. The issue also lists Form; the base-nova registry's `form` item is empty and Field replaces it, so it waits for the first form that uses it.

### 8 November 2026, loading and error states on every route (issue #72)

**Before asking:** the proposal promises loading and error states on every route, and `main` had none. I decided on the Lecture 8 pattern (p47-55) as one convention for the team: a root `loading.tsx` with plain fallback text and a root `error.tsx` with a `data-testid` and a button to try again, so `/`, `/onboarding` and `/session` are all covered without each owner adding a `<Suspense>` by hand. I wanted the tests to run in the existing Vitest setup without adding a browser test library, since Shubham's open pull request already brings Playwright.

**Asked:** what the `error.js` props are in our installed Next.js 16.4, what Cache Components changes for `force-dynamic`, and how to test a streamed Suspense fallback with `react-dom/server` alone.

**Got:** the bundled Next.js docs: `retry()` became stable in 16.3 and is preferred over `reset()` because it re-fetches the segment's data; with Cache Components, `force-dynamic` is removed and uncached reads must sit inside a `<Suspense>` boundary. For the test, `renderToPipeableStream` streams the fallback first and the content after the data resolves.

**Did with it:** wrote the tests first and watched them fail, then the two files. A first streaming test hung: React did not send the fallback when it was the whole output, so the test now renders a full document as the root layout does, and it shows the fallback before the data and the content after. Changing the fallback text or unwiring the button makes three of the four tests fail (the loading test and file were removed on 13 Nov). Added decision D16 and a Cache Components note for `/session` to `docs/ARCHITECTURE.md`. The task asked for a reset button and the shadcn Button; I used `retry()` per the current docs, and a plain Tailwind button because the repository has no shadcn components yet. No coach route exists on `main` yet, so the coach pull request adds its own pair or inherits the root one. The streaming test checks the fallback component inside `<Suspense>`; that Next.js picks up `loading.tsx` is covered by the build and the docs, and a Playwright check of `/session` can follow once Playwright is on `main`.

**13 November, after my own re-review:** the root `loading.tsx` had a fault I had not tested for. Its fallback starts the response before the page runs, so a signed-out request to a guarded page came back as 200 with a client-side redirect instead of a 307. I confirmed it against the Next.js loading docs, wrote a browser test for the three guarded pages and watched it fail (200, 200, 200), then removed the root loading file and its test and rewrote D16: the error state stays at the root, and a loading state goes inside the page after its sign-in check. An independent review checked the change before I pushed it.

### 8 November 2026, strength-only starter plan (issues #71 and #15)

**Before asking:** Farnaz found that the rule-based starter plan gives a Legs day of three stretches for a dumbbell and body-weight user. My fix was to filter the library to the "strength" category inside `buildDefaultPlan`, which is also the coach's fallback. Onboarding loads the library without its category, so a strict filter would leave it with no exercises; I chose to keep exercises that arrive without a category and to ask for the category in onboarding's query instead.

**Asked:** to reproduce her case on the seeded free-exercise-db data, and for an independent review of the change and its tests.

**Got:** the same picks she reported (All Fours Quad Stretch, 90/90 Hamstring and Ankle On The Knee on Legs, Chair Lower Back Stretch on Pull), because the dataset lists those stretches before the first strength exercise for those four muscles. The independent review found nothing blocking; it flagged that onboarding still keeps every stretch until its query selects the category, a lint warning in my test, and that the coach's own plans are not checked for category either.

**Did with it:** wrote a test from thirteen seeded records in dataset order (fourteen after a later review added a plyometrics record, Bench Jump, ahead of the first strength match, so a filter that only drops stretches fails too), saw it fail, then added the filter and a test that a library without categories still gets a plan. The pull request refers to #15 rather than closing it, and the onboarding change is asked for on the issue.

**Later the same day:** Farnaz suggested in her review that `buildDefaultPlan` require the category, so TypeScript points at any caller that forgets to load it. I agreed and reversed my earlier choice: the input type now requires `category`, an exercise without one is never picked, and the coach functions that pass the library through (`generatePlan`, `buildHybridWeek`) require it too. TypeScript then flagged onboarding's query, the eval script and the test fixtures; I added the category to each, including the one-line select in onboarding, so the quiz now gets strength exercises only. An independent review found nothing blocking; from its smaller points I moved the type next to `LibraryExercise`, matched the category without regard to case, pointed the comments at #71, and checked the input type with `expectTypeOf` instead of a `@ts-expect-error` line. Its run-time test caught my first case-insensitive version crashing on an exercise with no category, so that path now skips the exercise. Without the change, the new run-time tests fail and the type check fails; the full real library (876 exercises in free-exercise-db's `dist/exercises.json`, fetched 8 Nov) gave a plan for every quiz equipment and injury combination the review tried.

### 10 November 2026, board and docs upkeep (issues #70, #73 to #77)

**Before asking:** pull requests #70, #73, #74 and #77 were not on the project board, #75 and #76 still said In progress while they waited for review, #76, #77 and #78 had no enhancement label or assignee, and the Mohammad heading in this file sat above my entries from 27 October on. I decided the board, labels and section order myself and wanted only the mechanical edits done and checked.

**Asked:** to put those four pull requests on the board and set #70, #73, #74, #75, #76 and #77 to In review, label #76, #77 and #78 as enhancement with me as assignee on #77 and #78, move Mohammad's two entries under his own heading without changing any text, and correct the README line about integration tests in CI.

**Got:** the board, label and assignee changes through the GitHub CLI, confirmed by reading them back; the entries moved with every line of the file still present; and a CI file check showing that CI has run integration tests against PostgreSQL 16 on every pull request since #67, which is for accounts, trials and billing, not the quiz or session actions.

**Did with it:** kept the board and label changes, committed the section order and the README line separately, and left the architecture document's "not in CI yet" line for its own edit. Tools: gh CLI, engineering:documentation, commit-commands:commit, and an independent review agent that checked the diff and the CI claim before the push.

### 10 November 2026, "Why this plan" rows and panel (issue #66)

**Before asking:** the verifier already decides every plan in code, and issue #66 asks that the user can see that decision. I decided on a pure function from the plan's source and its log records to the rows, a small server component that only renders them, and no new model call. The issue says "plan page", but main has no plan page and the log records are not stored yet, so I chose to build the function and the component without mounting them, and to say that in the pull request.

**Asked:** for the function test first (one test per source state: model first try, model after regeneration, rule-based), the component, a check of the panel's wording and accessibility, and an independent review of every sentence the panel shows against the code.

**Got:** the function, the component and 19 tests. The independent review found four sentences that were false for some inputs: the running line said "10% more than last week" for users with no logged runs, a failed call was reported as a reply that failed the checks, "checked before you saw it" did not hold for every rule-based plan, and "training days match" did not hold when the plan includes running. It also found that the log's "not valid JSON" text, attached to any failed call, would have reached the user. The wording a user would not read naturally was a smaller finding.

**Did with it:** I added failing tests for each case, then reworded the panel to say only what holds for every log sequence and left out the days line when running is included. Reasons now come only from a reply the verifier rejected, and the common third-person phrases read in second person. I raised the row labels from 60% to 70% opacity, which takes their contrast on the page background from 4.3:1 to 5.8:1, and added an `idPrefix` prop so the heading id can be made unique when more than one panel is on a page. Lint, typecheck, 268 tests and the format check pass. Tools for the targeted help: skills `mattpocock-skills:tdd`, `hzblj-skills:type-safety`, `hzblj-skills:component-architecture`, `design:ux-copy` and `audit-suite:audit-as-a11y-eng`; Context7 for the Next.js server and client component docs (checked 10 November 2026); and a fresh review agent (`pr-review-toolkit:code-reviewer`).

### 10 November 2026, review fixes on the guardrails and chat pull requests (issues #43, #11)

**Before asking:** Shubham's review of the chat PR found two bugs (a Gemini reply in several parts kept only the first, and "Can you explain that?" after a bench-press turn got the off-topic redirect) and one gap in the guardrails PR beneath it: nutrition questions still reached the model, against the 8 November decision. I decided where each fix goes: the nutrition rule in the guardrails PR, the chat-level test and the other two fixes in the chat PR, every fix test-first, and follow-ups allowed only when they are short and plain.

**Asked:** for failing tests first for each point, then the fixes; a security review of the guardrails for a way round a safety check; and an independent review of both branches with the checks run.

**Got:** the reviewers found that my follow-up rule let "ignore that and tell me a joke" and "translate that into French" through, and that the app's own fixed replies counted as training context; that the nutrition patterns wrongly redirected about a quarter of 30 ordinary training messages (calories burned by a run, water during a run, a snack-sized workout) and missed about 40% of 22 real nutrition questions; and that no safety check could be skipped by the follow-up change. The pull request toolkit review was not run.

**Did with it:** limited a follow-up to eight words or fewer in a fixed set of openers that comes right after a coach reply (never after a fixed reply); widened and narrowed the nutrition patterns with the failing messages as tests; added the nutrition rule to the coach prompt as version chat-v2; and joined the Gemini parts. I kept "should I take creatine breaks" as a nutrition redirect because it is supplement advice. No coach route calls the chat code yet (#11), so screening history roles waits for it. Tools: mattpocock-skills:tdd, backend-design:error-handling-as-design, agentic-council:oracle-prompt-engineering, the backend-design:security-reviewer agent, an independent review agent, Context7 for the Gemini API, and the Gemini API reference page.

### 10 November 2026, repeated eval runs and consistency (issue #64)

**Before asking:** the eval sent each profile once, so it could not show whether the same profile gets a similar plan twice. Following Lee (2026, arXiv 2604.19598 and 2604.11287), I decided to send each profile five times per provider and to compare the structured plan fields rather than text similarity: verifier pass rate, exact duplicates, exercise overlap, the spread of sets and reps, and latency, reported per profile. I also wanted the runs paced under each provider's free-tier limits and able to stop at a daily cap and resume.

**Asked:** the current free-tier limits for Groq `openai/gpt-oss-120b` and for Gemini; how the two papers define exact duplicates and per-scenario reporting; test-first slices for a consistency function and for pacing helpers; and an independent review of the branch before the pull request.

**Got:** Groq's base limits (30 requests a minute, 1,000 a day, 8,000 tokens a minute, 200,000 a day) from Groq's docs. Gemini's free-tier limits are shown only per project in AI Studio, with the daily count resetting at midnight Pacific. The papers count exact duplicates per scenario on preprocessed text and warn that embedding similarity misses numeric changes, which supports comparing fields. The review found that the providers' own retries bypassed the pacing and the call count, and that a 429 on the first call was being scored as a verifier failure.

**Did with it:** wrote `consistency.ts`, the pacing helpers and the `--repeat` flag test first, and fixed the review findings (retries off in repeat mode, failed first calls left pending, argument parsing tested). The first live run then showed calls timed at about 60 s: I had put the pacing wait inside the timer. I moved the wait before the timer, with a test that fails on the old code, and set that run's files aside. The run itself was stopped partway when the machine ran low on memory, so the results table in `docs/COACH_EVAL.md` waits for a fresh run (pull request #87). Tools: agentic-council:oracle-ai-evaluation, mattpocock-skills:tdd, agentic-sdlc:testing-vitest, omniout:add-fallback, Context7 (Groq and Gemini docs), Firecrawl (Gemini rate-limit page), alphaXiv (both Lee papers), and /pr-review-toolkit:review-pr as the independent reviewer.

### 10 November 2026, competitor benchmark, domain check and follow-up issues (issues #91 to #95)

**Before asking:** I had benchmarked fitness platforms for the 5:30pm design review. I decided which ideas to take, which to leave out (generating every session from scratch, a human-coach tier, nutrition), and that all of the new ones wait until after the 15 November core path.

**Asked:** to put the note in `docs/design-reviews`, check the candidate domain names with an RDAP lookup, open one backlog issue per idea with a one-line reason, and check every claim in the note against its sources and against what is merged on main.

**Got:** the note on main, a dated domain table (three names have no registration record, two are registered), and issues #91 to #95 with the enhancement label, my assignment and Backlog status. The task said six domain candidates; the note lists five, so I checked five. The review corrected the note: three sentences claimed things that are only in open pull requests or not shown on a page yet (the verifier on every plan, the pain guardrails, the fallback); Hevy's Trainer already has an injury setting that swaps or warns; the Jefit comparison is a competitor's own page; the lower bound of the coaching price had no source; and the Runna wording went beyond what the sources say.

**Did with it:** I applied the corrections in a separate commit and marked what could not be confirmed (the WSJ full text and its date, the TechRadar article, and any source for Fitbod's periodization). I kept the issue bodies to one line of why plus a link to the note. Tools for the targeted help: skills `engineering:documentation` and `product-management:write-spec` (the issues stayed one line each, so I did not write full specs), the gh CLI, curl for the RDAP lookups, and a fresh review agent (`general-purpose`) that checked the claims through web search, the ExerciseBank and PubMed connectors and the GitHub issues.

### 10 November 2026, Shubham's two review notes on the shadcn/ui pull request (issue #75, PR #77)

**Before asking:** Shubham reviewed #77 on 8 November (no blocking issues, "Happy to approve") with two notes: document Node.js 22 as the minimum, and when the pull request is combined with #67 keep the account links, update the test that expects one link and retain the Vitest exclusions. I wanted the second note done test first, because the old test, which expects exactly one link, fails on the merged page, and I wanted the Node floor read from the packages' own declarations, not only from the one package he named.

**Asked:** to merge `main` into the branch and resolve the conflicts file by file, to read the `engines` field of the direct dependencies, to update the root-page test so it expects the quiz link and the two account links, and for an independent review of the merged branch, the test and the two docs lines (the README line and the `docs/LOCAL_DEVELOPMENT.md` line).

**Got:** `cn` 0.5.2 declares Node `>=22`, Vitest 5.0.5 declares `^22.12.0 || ^24.0.0 || >=26.0.0` and Prisma 7.10.1 `^20.19 || ^22.12 || >=24.0` in their packages, which Vitest's migration guide and Prisma's system-requirements page agree with (checked 10 November 2026), so I first set the floor to 22.12. The independent review then checked every package in the lockfile and found that `eslint-visitor-keys` 5.0.1, a dev-only dependency of `@typescript-eslint/visitor-keys` (pulled in through eslint-config-next), declares `^20.19.0 || ^22.13.0 || >=24`, so the floor became 22.13. It also showed, by moving the account links out of the card, that my card test could not fail, because it only checked that the links came after the card's opening tag. Main's Vitest config already held the integration and end-to-end exclusions, so it replaced mine.

**Did with it:** wrote the updated page test first and watched three of its seven tests fail on the page without the account links, then added the links under the quiz button in the card footer; replaced the card test with one that slices the card's markup, and showed it fail when the links sit outside the card; set `engines` to `>=22.13.0` and the README and `docs/LOCAL_DEVELOPMENT.md` to match; regenerated the lockfile from main's with `npm install`, which also moved five Babel packages to newer patch versions, and added the root `engines` block by hand (three lines) after a second `npm install` rewrite added unrelated optional packages and I discarded it. Tools for the targeted help: the `vercel:shadcn`, `prism:stack-nextjs` and `agentic-sdlc:testing-vitest` skills, and `pr-review-toolkit:review-pr` with its `code-reviewer`, `pr-test-analyzer` and `comment-analyzer` agents as the independent check.

### 10 November 2026, streaming review fixes and a second guardrail security pass (issues #11, #43)

**Before asking:** Shubham's review of the streaming PR asked for four changes: the same checks as the chat PR, fallback when the connection drops before any text, cancelling the provider's stream when the reply check stops it, and a visible reply when a stream ends empty. I decided to merge the chat PR into the streaming branch rather than rewrite its history, to share one preparation step between the plain and the streamed turn, and to write each test before its fix. I also asked for the guardrails to be security-reviewed again after the last round of fixes.

**Asked:** for failing tests first, then the fixes; a fresh security review of the guardrails and chat PRs; a review hunting for errors the streaming code hides; and an independent review of the streaming PR, with the checks run and each test shown to fail without its fix.

**Got:** the security review found that a line break, a double space or a zero-width character hid "trouble breathing" or "chest pain" from the word list, that history could pass roles other than user and assistant, and that the middle of a very long message is not screened. The hidden-error review and the independent review found that an error sent inside the stream or a malformed line ended the stream quietly instead of falling back, and that the architecture table said fallback happens before the first sentence when the code decides at the first text piece. The independent review confirmed all four points were fixed and that the new tests fail without the changes.

**Did with it:** normalized text before every safety pattern, kept only user and assistant turns in history, put the 9-8-8 line in the length reply, and widened the drug and diagnosis list in the reply check. In the streaming code, in-stream errors, malformed lines and a Groq stream without its end marker are now provider failures, and the decision table says when fallback runs. A log entry for a streamed failure is left for when a route calls the stream, as stated on the pull request. Tools: mattpocock-skills:tdd, backend-design:error-handling-as-design, backend-design:idempotency-and-side-effects, coding-skills:retry-amplification, omniout:add-fallback, the backend-design:security-reviewer agent, the pr-review-toolkit:silent-failure-hunter and pr-review-toolkit:code-reviewer agents, and Context7 for the MDN stream reader and Groq streaming pages.

### 10 November 2026, coach personas literature note (issue #80)

**Before asking:** #80 says a persona changes wording only, with a calm technical default and a strict style that is opt-in. I wanted to know what the research on coaching style says before anyone builds it, so I had a first pass written from eight papers through the Lune connector.

**Asked:** to file the note in `docs/papers` with its row in the paper index, and to check every paper and figure in it against the papers themselves and against #80 before it went to main.

**Got:** a review that confirmed all eight papers exist with the right authors, venues and DOIs, and corrected the note's reading of several. The biggest: the GymBuddy paper did not use the controlling coach as a negative case (it was ranked last by 9 of 14 participants, but some said it made them try hardest). Also: the Srinivas study's styles change the flow of the conversation, not only the wording, so it does not test wording-only personas; a directive option has less support than the first draft said (facilitative beat directive in that study); and the draft's proposed default (supportive) contradicted #80's calm technical default. The review also added missing numbers and DOIs and found a "Feeds #84" line that no part of the note supported.

**Did with it:** I rewrote the note so each claim says what the paper found and how it was read (full text for five papers, abstract only for three), dropped #84 from the index row, and changed the persona paragraph to say the papers do not settle the default, which stays a decision on #80. I have not re-read the corrected figures in the papers myself; they come from the check's reads. Tools for the targeted help: the Lune connector (paper search, extraction and full text), Crossref and arXiv, the ACM and PubMed Central pages through Firecrawl, the gh CLI, and a fresh review agent (`general-purpose`).

### 10 November 2026, the coach chat screen (issue #63)

**Before asking:** the core path ends with one coach exchange, and no screen used the chat turn from #53. I decided the shape: a Server Component reads the user's conversation, a Server Action does the turn and saves both messages in one transaction, and the guardrails stay inside `coachReply` so no path reaches the model without them. Streaming (#56) is not merged, so the reply comes in one piece for now. Free accounts see the tier message, and a failed reply shows what happened with Send again, saving nothing half-done (#42). I left Mohammad's session page alone because #83 changes it, and noted the missing link in the pull request.

**Asked:** the Next.js 16 conventions for Server Actions, `useActionState` and the route `error.tsx`; test-first slices for the action, the page, the message list, quick replies and the retry notice; an accessibility pass; a security review of the guardrail path; and independent reviews of the branch before the push.

**Got:** the docs confirmed `retry()` re-fetches the segment where `reset()` does not, and that a `"use server"` file may export only async functions, so the screen's wording moved to its own file. The security review found no per-user cap on model calls. The first review found that a failed database read threw to the error page, and that nothing tested the history the model receives. The second found that my first cap counted saved messages, so parallel or failed sends got through. The accessibility pass found that focus was lost while the coach replied, and small labels at 3.66:1 contrast.

**Did with it:** wrote each slice test first and fixed every finding. A failed load now offers Send again. A per-user cap of 5 messages a minute and 50 a day counts attempts before the model call, and the saved-message count backs it up across server instances. Tests cover the history order, the no-plan case and the ownership check. Focus is kept, and the labels are at 5.85:1. A pain report and a diagnosis request get the fixed reply without calling the model, and a test pins it (draft pull request #96). Tools: vercel:nextjs, vercel:react-best-practices, hzblj-skills:component-architecture and hooks, design:ux-copy, mattpocock-skills:tdd, agentic-sdlc:testing-vitest, audit-suite:audit-as-a11y-eng, Context7 (Next.js docs), backend-design:security-reviewer, and /pr-review-toolkit:review-pr as the independent reviewer.

### 10 November 2026, self-review of the guardrails and hosting pull requests (#48, #61)

**Before asking:** both pull requests had waited past the three-day review window. I decided they would get an independent review instead: a reviewer that sees only the diff, the issue and our engineering practices, plus a second check that confirms each finding before it counts. I also decided that nothing merges until I run the merge myself, and that #48 merges before #53, which is stacked on it.

**Asked:** blind reviews of #48 (code quality, silent failures, security) and #61 (code quality, silent failures, deployment and CI, workflow security), a fresh check of every round of fixes, and the current Vercel, Neon, Better Auth and Prisma pages for each claim in the Deploy section.

**Got:** for #48, missed crisis and eating wordings, training talk wrongly stopped, a screen that did not report when the model check failed, and regexes that slowed badly on long messages. Each later round of checks found that some fixes had moved other wordings the wrong way, so I set a limit of four rounds. For #61, a leftover direct database URL could redirect the test migrations, a hosted build could start with a missing URL or with two URLs on different Neon branches, CI never ran the migrate path, the README lacked the auth and email settings, and the preview reset could copy real users.

**Did with it:** wrote a failing test for every finding before fixing it, and pushed #48 after the last round's blocking findings were fixed (844 unit and 46 integration tests). The remaining false positives and gaps are listed on the pull request as follow-ups. A plugin rule stopped me from staging the environment template, so the #61 fixes are verified but wait for me to commit and push them by hand. Tools for the targeted help: pr-review-toolkit:code-reviewer and silent-failure-hunter, backend-design:security-reviewer, vercel:deployments-cicd, sweetclaude:workflow-guardian, fresh general-purpose agents as second checks, and Firecrawl for the Vercel, Neon, Better Auth and Prisma pages.

### 10 November 2026, token counts and guardrail verdict on the model-call record (issue #41)

**Before asking:** #49 already writes one in-memory record per model call. Our engineering practices (item 6) ask the coach log for the tokens of each call, and I decided the record should also say what the guardrails decided about the user's message, so a stored refusal can be told from an answer; nothing written asks for that verdict yet. The CoachEvent table (#52) stays Shubham's, so this pull request adds the fields to the record only, with no migration and no table, and says "Refs #41" because the storage is #52. A plan call has no user message to screen, so the verdict is passed in and stays null until the chat path supplies it. Null means the provider sent no count; it never means zero.

**Asked:** which usage fields Groq and Gemini put in their responses; a failing test first for each case (a count, no count, a count in the wrong form, a reply that was not JSON, a switch of provider, the rule-based record); and an independent review of the diff before the push.

**Got:** the Groq response has `usage.prompt_tokens` and `completion_tokens`; the Gemini response has `usageMetadata.promptTokenCount` and `candidatesTokenCount`, with thinking tokens in a separate `thoughtsTokenCount` that Gemini bills as output (Context7 on the Gemini and Groq documentation; the review read the Gemini pages). The review confirmed the tests fail on the old code (10 of 15) and found that #48 had merged meanwhile, so the "not merged" wording was stale and the verdict can be typed from `guardrails.ts`. It also found that a Gemini response with thinking tokens but no answer count would have been logged with no output tokens even though they were billed. Groq's pages do not say whether `completion_tokens` includes the reasoning tokens of the gpt-oss models, so the record says "as the provider reports them".

**Did with it:** wrote the tests first and saw 10 fail, then the one for the thinking-only response and saw it fail. The provider adapters now report the counts they find, before the reply is parsed, so a reply that was not valid JSON still has its tokens. The record carries `inputTokens`, `outputTokens` and `guardrailVerdict`; for Gemini the output count is the answer plus the thinking tokens, and either one alone still counts. The verdict is typed as the guardrail's action name. Tools: Context7, backend-design:observability-by-default, agentic-sdlc:testing-vitest, a fresh review agent (`pr-review-toolkit:code-reviewer`).

### 10 November 2026, demo mode with cached coach plans (issue #59, PR #99)

**Before asking:** the 3 November design review decided the demo's fallback must be immediate and its coach outputs cached (D12). I decided where the cache lives before any code: a file in the repository holding the coach's own verified plans from the 30 October eval, not a cache filled from live replies, which would be empty in a rehearsal with the network off. I decided a cached plan is served only when it passes the verifier for the user's own profile, that it is a coach plan but must be labelled as written earlier, and that plans come first and chat replies in a later slice. The design went into `docs/ARCHITECTURE.md` before the code.

**Asked:** the current Vercel runtime cache and Gemini model pages; test-first slices for demo mode in the provider chain and for the cache in plan generation; a list of what could go wrong on demo day; and an independent review of the branch, then a second check of the fixes.

**Got:** the review found that my worst case of 16 seconds was wrong: a reply that stalled after its headers, or a rejected plan, sent the request round the chain a second time, up to about 32 seconds. My latency figures came from the first eval round on Gemini Flash, not the Flash-Lite model the fallback uses. My test only caught a prompt change when the version was bumped. And the architecture note described a screen that does not exist yet. The incident list found the same stalled-body gap independently.

**Did with it:** wrote a failing test for each finding before fixing it. Demo mode now makes one attempt, so the worst case really is one pass through the chain. A stalled body counts as a provider timeout. The cache carries a hash of the prompt, so any wording change fails a test until the cache is refreshed. The demo sets the Flash-Lite model. I corrected the architecture note to say the "Personalize with the coach" action (#58) will show the cached plan. 877 tests pass. Tools: backend-design:error-handling-as-design, vercel:runtime-cache, agentic-sdlc:testing-vitest, backend-design:incident-thinker, pr-review-toolkit:code-reviewer as the independent reviewer, and Firecrawl for the Vercel and Google pages.

### 10 November 2026, an RPE target per plan exercise (issue #65, pull request #101)

**Before asking:** plans stated sets, reps and rest but not how hard each exercise should be, and the 8 November research (Lee) found intensity was the least stable part of generated plans. I decided on an integer RPE from 6 to 9 on each exercise, checked in code like the other ranges, and that it would be validated but not stored, because storing it needs a migration the issue does not ask for.

**Asked:** the test-first cases (accepts 6 to 9, rejects 5, 10, a decimal and a missing value; the default plan sets 7; the prompt asks for it) and an independent review of the branch.

**Got:** the review found that the plan prompt version had not been bumped, that one new test would pass even if the retry listed no problems, that the architecture doc and decision record were stale, and that the open demo-mode pull request (#99) caches replies without an RPE, so they would all fail the verifier. It checked the scale against Helms et al. (2016): RPE 7 is about three reps left, and the 6 to 9 band covers one to six.

**Did with it:** I bumped the prompt to `plan-v3`, made the retry test name the `rpe` problem, wrote the scale and its source into the schema comment and the D17 row, and listed the #99 clash and the missing live run against Groq and Gemini in the pull request. The 30 October eval replay adds `rpe: 7` to the recorded replies, which predate the field. Lint, typecheck, 865 unit tests and the format check pass. Tools for the targeted help: a fresh review agent (`pr-review-toolkit:code-reviewer`) and git.

### 13 November 2026, a real walk-through of the core path and five more pull requests brought current (issues #57, #72, #75, #76, #63)

**Before asking:** I wanted to know what Sunday's checkpoint would actually show, so I decided to run the core path for real, in a browser against a local database, on a branch holding `main` plus the open pull requests it depends on, and to record each step as pass or fail. I also wanted my conflicting pull requests merged with `main` and their known faults fixed, each checked by a reviewer that had not seen the work before the push. My rules for it: merge, never rebase; a failing test before each fix; nothing created in the Vercel or Neon accounts.

**Asked:** for the walk-through script and run, the merges, the fixes with their tests first, and an independent review of each branch before pushing.

**Got:** the walk-through passed sign-in, the quiz, a strength-only starter plan from the real 876-exercise library, a logged workout and a live coach exchange saved in about two seconds. It showed three things I would not have known otherwise: a new account must start its free trial before either coach will answer, the coach and photo pages have no link leading to them yet, and the photo step cannot run without the storage keys. The reviews found that the hosted build could still skip migrations without a word when Vercel's system variables are off (the variable my check relied on is one of them), that a loading file above a page that redirects turns a signed-out 307 into a 200 (the root one I had added, and the coach page's), and that an open-ended Node version range would make the hosted build run a newer Node than CI tests.

**Did with it:** fixed each with its test first: the build command now stops unless it is a production or preview build; the root and coach loading files are gone and a browser test asserts the 307; decision D16 now puts loading states inside the page after its sign-in check; both pull requests that set the Node range use the same one. The review of the deploy change needed three rounds, because my first two fixes for keeping a misread connection string out of the build log each left a case open; I stopped at three and say so in the pull request. I filed one issue for a teammate instead of touching his file (the quiz saves "kettlebell", the library says "kettlebells"). Four of my earlier entries in this file sit under Shubham's heading; I left them there for now so his open pull requests do not conflict, and will move them once those merge. Tools: Playwright for the walk-through, a local PostgreSQL instance, the pr-review-toolkit code-reviewer agent and the backend-design schema-reviewer agent for the independent reviews, and the Next.js and Vercel documentation for the two platform rules.

### 13 November 2026, afternoon: approved pull requests onto main and the open reviews closed (pull requests #105, #107, #109, #102, #53, #96, #73)

**Before asking:** I set the merge order from the morning walk-through: Shubham's sign-in and coach-tier pull requests first, then Farnaz's photo storage, then my three core-path pull requests, which were past the three-day review window. My rules for it: merge commits so every commit keeps its author, main green after each merge, a teammate's code gets a comment and is never edited, and every review gets two independent passes, the second from a reviewer that had not seen the first.

**Asked:** for a review of the one commit Farnaz pushed after my approval on #109, checked against the 4.5 MB Vercel request limit; for a full re-review of Mohammad's #102 against my two 11 November comments and issue #111; and for my own branches to be brought up to date with main and checked.

**Got:** both #109 passes found nothing blocking. The photo form now shrinks images in the browser, the server takes at most 4 MiB, and Vercel's limits page confirmed the 4.5 MB cap. Both #102 passes found every 11 November point closed and #111 fixed in that pull request. One integration test failed on three different branches, including #73, which does not touch the coach. The cause is on main: the exercise coach saves the question and the answer in one transaction, so both rows share a timestamp, and the history query orders by timestamp alone.

**Did with it:** merged #105, #107 and #109, with main green after each, and approved #102 for Mohammad to merge. I filed the timestamp fault as #112 for Shubham, with the fix (break ties by id), rather than editing his file; my coach chat already breaks the tie that way. #110 needs more than a conflict resolution after #109 (a changed function signature and the new upload limit), so I left Farnaz a comment instead of editing her branch. My three pull requests are up to date with main, green, and have their self-review comments. Their merge waits on the branch-protection step, since none has a teammate's approval yet. I also caught a wrong unit-test count in my own #53 comment and corrected it: stale local copies of old test files had inflated it. Tools: the pr-review-toolkit and agent-protocols code-reviewer agents for the independent passes, the GitHub CLI, and the Vercel documentation for the request limit.

### 10 November 2026, quiz plans with run days (issue #85)

**Before asking:** the quiz plan came from `buildDefaultPlan`, so it never had a run day and the session screen had nothing to show for runs, although `buildHybridWeek` and `saveWeek` could already store them. I decided the quiz asks for training mode, strength by default, and that only running and both take the new path, so a strength quiz stays as it is. The quiz action is Mohammad's file, so I kept my change there to one early branch and put the rest in my own files.

**Asked:** the test-first slices (a both-mode quiz saves a run day, running-only saves runs, strength-only is unchanged), the Next.js Server Action form handling, and an independent review of the branch.

**Got:** the review found that the profile and the plan were saved in two steps, so a failed plan save would leave the profile saying running with the old strength plan active, and that the hybrid week was saved without running either verifier, against D9. It also found tests that would pass without the change, and the new-runner default missing from the docs.

**Did with it:** `saveWeek` takes a hook that runs inside its transaction, so the profile is saved with the plan or not at all; a test makes the plan fail and checks the profile is unchanged. The strength and running verifiers run before saving. I tightened the running-only test to two runs and two strength days, and added tests for the saved mode, one-day running and the refusal paths. The new-runner default and the options it beat are in the D9 note in `ARCHITECTURE.md`. Lint, typecheck, 850 unit tests, 54 integration tests on PostgreSQL 16 and the format check pass (pull request #97). Tools for the targeted help: skills `agentic-sdlc:testing-vitest` and `hzblj-skills:functions`, Context7 for the Next.js Server Action and `useActionState` form docs (checked 10 November 2026), and a fresh review agent (`pr-review-toolkit:code-reviewer`).

### 10 November 2026, bringing the chat pull request current after #48 merged (issue #11, pull request #53)

**Before asking:** #48 was squashed, so the chat branch still carried the guardrail commits it had merged one by one, and git reported add/add conflicts in the guardrail files. I decided to merge the #43 branch first, so the chat changes kept their place, and then main, instead of taking main's copy of every guardrail file, which would have dropped the chat branch's `mentionsTraining`.

**Asked:** the merge, and an independent review of the result against main.

**Got:** the typecheck failed after the merge: main already has its own chat model (`coachChatModel`), which duplicated the one in this branch. The review found no blocking issue and noted that the route must pass history from stored rows, not the request body.

**Did with it:** I dropped the duplicate chat model and used main's. Main's Gemini chat reply kept only the first text part, the bug Shubham found, so I re-applied the join-all-parts fix there; the test failed first. Lint, typecheck, 991 unit tests, 46 integration tests on PostgreSQL 16 and the format check pass. Tools for the targeted help: `pr-review-toolkit:code-reviewer` (fresh context) and git.

### 10 November 2026, guardrail false positives and misses left from #48 (issue #43)

**Before asking:** the review of #48 left a list: training talk the crisis word list still mistook for a crisis (a rep or load count after "pills", "kms" as a distance unit, "won't be here tomorrow so I can't train", jumps into a pool or onto a box) and three diagnosis questions it let through ("did i break my back squatting", "did i tear my shoulder pressing", "did i tear my pec"). I decided every fix stays inside the guardrail module, that each case gets a failing test first, and that if a fix would turn an existing crisis test red the crisis reading wins and the case is logged for the model check instead.

**Asked:** the test-first slices, the narrowing of each pattern, and an independent review of the branch that had not seen the work.

**Got:** the review ran the same probes against main and against the branch and found my first fix too wide: a swim word anywhere let "i can't swim, i'm on the bridge and i'm gonna jump into the water" through, a jump onto a "platform" or "step" from a roof stopped being a crisis, the "so i can't train" and "so i need to reschedule" exceptions accepted any words after them ("...so i need to reschedule my funeral"), and "using kms" and "school vs kms" were let through.

**Did with it:** each of those inputs is now a test that failed first and stays a crisis. The jump exception needs a pool named just before the jump or a plyo box, and does nothing when the message has a height ("bridge", "below", "from here") or "can't swim". The scheduling exceptions need a training object or the end of the sentence. "Kms" is a unit only after "prefer" or a "miles vs" pair. Load units after "pills ... 20 more" stop counting when ingestion words follow. The diagnosis list gained pec, biceps, triceps, quads and groin, and a lift name no longer hides "squatting" or "pressing". Left to the model check, not coded: "kms today", "kms for real", "on the roof i'm jumping", and a roof or bridge jump into water. Lint, typecheck, 903 unit tests and the format check pass. Tools for the targeted help: skill `agentic-sdlc:testing-vitest`, skill `backend-design:error-handling-as-design` (not run, see the log), and a fresh review agent (`pr-review-toolkit:code-reviewer`).

### 13 November 2026, getting the core-path pull requests mergeable (issues #11, #71, #63; pull requests #53, #73, #96)

**Before asking:** the chat turn (#53) and the strength-only starter plan (#73) conflicted with `main`, and the chat screen (#96) sits on #53, so none of the three could merge before the 15 November checkpoint. My plan was to merge `main` into each branch rather than rebase, apply the fixes my 11 November re-review had found but not pushed, and have each branch checked by a reviewer that had not seen the work before I pushed it. I had already decided that the injury text a user types must not reach a model, and that a refusal must never be the only thing a person in crisis reads.

**Asked:** for the merges and the fixes, each with its failing test first, and for an independent review of each branch before the push.

**Got:** the review of #53 found that a failed model call could put the first characters of a provider's reply into a log record, and that natural follow-ups such as "what do you mean by that exactly?" were being redirected. The review of #96 found that a message over a rate cap got "wait a moment" even when it held crisis wording. My own reading found that `/coach` would load a body-map exercise chat as the coach conversation, because both are stored as conversations of the same user. The review of #73 ran the real starter plan on the full 876-exercise library for 67,914 quiz profiles and found none that lost a plan.

**Did with it:** kept the fixes small and in my own files. Failed chat calls are recorded by the provider's fixed message or the error's name. The follow-up rule accepts a quoted term and a trailing "please", "again" or "exactly". `/coach` loads only the untitled conversation. The coach gets muscles to avoid from the injury text by the same code rule onboarding uses. Only replies that mean the person needs help replace a cap message. I corrected a test count I had first reported for #53 (956, not 1,057: stale copies of test files in my local folder had been counted). Tools: the pr-review-toolkit code-reviewer agent for the independent reviews and the checks on the changed lines.

### 15 November 2026, checkpoint 1 audit and the Lecture 9 practices

**Before asking:** the checkpoint needs a list of where each core-path step and course requirement stands on `main`, each tied to a commit or PR, plus the Lecture 9 practices written down so reviews can use them.

**Asked:** an AI assistant (Claude Code) to draft the execution audit from `git log`, the GitHub PRs, reviews and issues, and the CI runs; to turn Lecture 9 into numbered practice rows with slide references; and to check `main`, the open photo PRs and #115 against those rows.

**Got:** the audit (`docs/audits/2026-11-15-execution-audit.md`), rows 8 to 19 in `docs/ENGINEERING_PRACTICES.md`, and draft review comments for #113, #114 and #115. It found no gap on `main` against the new rows. Main CI failed again on the exercise-chat ordering test (#112).

**Did with it:** checked each row against the slide it cites and against the code before committing. Checked the Next.js `bodySizeLimit` docs and the new dependency's npm record before the #113 and #114 comments. Dropped one draft review point (duplicate React keys) after reading `groupByExercise` showed it could not happen. Posted the reviews as comments; the live walk-through is still owed because the laptop did not have enough memory. Tools: Claude Code, Context7 for the Next.js docs, `npm view`, `pdftotext` for the lecture slides.

### 15 November 2026, review passes before pushing #77, #74 and #61 (issues #75, #72, #57)

**Before asking:** three of my pull requests had `main` merged in locally, and I wanted each one checked by a reviewer that had not seen my reasoning before I pushed.

**Asked:** an AI assistant (Claude Code) to run separate review passes, one after another, on each diff and its pull request description, against the issue, `docs/ENGINEERING_PRACTICES.md` and the source code.

**Got:** most findings were wrong statements in the descriptions and docs rather than in the code. On #77, the docs and then the description said no screen on `main` uses the rounded-corner classes, but `/coach` does. On #74, it described a coach loading file that #96 never added. On #61, one pass found that my first fix to the deploy steps did not work: in Windows PowerShell 5.1, setting a variable to an empty string removes it, so the seed would still read the demo password from the local env file.

**Did with it:** checked each finding against the code before changing anything, and re-ran the PowerShell behaviour myself. Fixed the docs and descriptions, added `/progress/photos` to the signed-out redirect test on #74, and pushed only after a pass with no errors. One wording suggestion on #61 (single quotes for the connection string) is listed as a follow-up on the pull request. Tools: Claude Code and its code-reviewer agents, `gh`, Prettier and ESLint.

### 17 November 2026, the deploy pull request after the team chose Vercel Storage for Neon (issue #57, pull request #61)

**Before asking:** at the 17 November meeting the project went onto Mohammad's Vercel account with Neon connected through Vercel Storage, a database branch per preview. Main's build is plain `next build`, so nothing applied migrations or loaded the exercise library; that night a dashboard Build Command did both by hand. I wanted #61 to do it properly: bring it current with `main`, run the exercise seed after the migrations on every hosted build without ever creating demo logins, and make the README match the setup and the variable list we agreed.

**Asked:** an AI assistant (Claude Code) to check the Neon integration's variable names and preview branching against Neon's current docs, to write the failing tests for the seed step first, then the change, and to have a reviewer that had not seen the work check the result.

**Got:** Neon's docs (checked 17 Nov) confirm `DATABASE_URL` is pooled and `DATABASE_URL_UNPOOLED` direct, with preview values given to each deployment's build, so #61's rule (migrate over the direct URL on hosted builds) already fit. The review found one real fault: CI runs the build script against the test database, so the seeded library would have changed which exercises the browser test's starter plan picks. It also found that the script handing the blank demo password to the seed was untested, and that three doc statements were off: preview cleanup on Hobby is 30 days, not months; preview branches come from the default branch; Neon describes a custom variable prefix as added in front of `DATABASE_URL`.

**Did with it:** gave the CI build its own empty database (which also checks migrate-from-empty plus seed), moved the step loop into a tested `runSteps` and checked that removing the blank password or the stop on failure makes a test fail, corrected the README and D19, and asked Mohammad to confirm the variable names in Vercel. Unpinned seed download left as a follow-up issue. Tools: Claude Code with the `vercel:deployments-cicd`, `opinionated-prisma:migration-safety` and `superpowers:verification-before-completion` skills, its code-reviewer agent (review and delta check) and workflow-guardian agent (CI change), Context7 and Firecrawl for the Neon docs, `gh`, Vitest, ESLint, Prettier.

### 18 November 2026, bringing the streamed coach replies up to date with `main` (issue #11, pull request #56)

**Before asking:** Shubham asked for #56's conflicts to be resolved and CI rerun before he re-checks his four points: the safety limits, the body-read fallback, the upstream cancellation and the empty-stream handling. Since the PR was opened, `main` had rewritten the coach's providers and added a log record for each model call. My plan was to merge `main` rather than rebase, keep `main`'s provider types and logging as the base, and move the streaming onto them. The checks a message goes through before the model call would be one shared step for the plain and the streamed turn, so the two cannot drift apart again.

**Asked:** an AI assistant (Claude Code) to resolve the merge on that plan. It was to write failing tests first for the behaviour that had to change: one log record per streamed call, including when the reader stops early; the serving model named in that record; and a stream with no text moving to the other provider, as a plain reply with no text already does. Then a reviewer that had not seen the work would check the merge against `main` and against the old PR head.

**Got:** the merged branch, with the streamed turn in its own module and the request settings shared with the plain call. The review found no errors. It found one real gap: a stream that sent only whitespace counted as started, so the other provider was never tried. The delta check then found that such whitespace would show as a blank first line. While merging I also found that `main` itself failed its type check after #97 and #101 landed together: a test fixture lacked the now-required RPE.

**Did with it:** had both whitespace gaps fixed test-first, each test shown failing before its fix. I checked by mutation that removing each new record or served event fails a test, noted in D10 that the stream has no same-provider retry, and added the RPE to the fixture so the branch type-checks. Lint, type check, Prettier and the 1,384 unit tests pass locally; CI (unit, integration, e2e) is green. Tools: Claude Code with the `mattpocock-skills:resolving-merge-conflicts` and `superpowers:verification-before-completion` skills, its `pr-review-toolkit:code-reviewer` agent (blind review and delta check), `gh`, Vitest, ESLint, Prettier.

## Mohammad

### 31 October 2026, onboarding quiz validation edge cases

**Before asking:** the quiz schema already constrained training days to 1–7, goal and level to Prisma enums, equipment to the supported exercise-library values, and injury notes to 500 characters. The existing tests covered a valid form payload, missing equipment, and an out-of-range schedule, but not the boundaries or malformed values.

**Asked:** what edge cases should be added to `schema.test.ts` based on the current quiz schema.

**Got:** suggestions to test both valid day-count boundaries, invalid fractional and non-numeric day counts, unknown goal and level values, unsupported equipment, and injury notes at and over the length limit.

**Did with it:** checked each suggestion against the schema instead of treating the list as requirements, added the applicable cases, and ran the focused Vitest file. An initial test run exposed that Vitest did not resolve the schema's `@/` alias, so I changed that import to a relative path. The focused tests passed (11/11), and the full suite passed (12/12).

### 1 November 2026, rest timer UI

**Before asking:** the rest timer countdown worked, but its state changes were subtle and users could think the button did nothing.

**Asked:** how to make the timer's running, paused, and completed states clearer and more visually noticeable.

**Got:** suggestions to give the countdown stronger visual emphasis and display a clear status label as it changes state.

**Did with it:** updated the timer to highlight while running and show explicit “Resting”, “Paused”, and “Rest complete” states; verified in the browser that clicking Start rest changes the button to Pause timer and the countdown decreases. Styled the UI with Tailwind utility classes. No shadcn/ui components were used.

### 10 November 2026, exercise cue library (issue #8)

**Before asking:** the exercise library already contained 876 records, while its `cues` and `commonMistakes` fields were empty. Issue #8 asks for original, concise form guidance on 30 beginner or intermediate strength exercises across the main movement patterns.

**Asked:** to select eligible seeded exercises, review one source for each, and write three to five form cues and two to three common mistakes per exercise. I also asked for AI assistance to be recorded transparently in this session log.

**Got:** AI-assisted summaries of setup, movement and common technique errors from exercise-specific ExRx pages and the upstream Free Exercise DB records used by our seed. Candidate IDs and their category, level and equipment were checked against the seeded database. Where an external page did not provide a usable or matching description, the source list cites the exact upstream library record instead.

**Did with it:** reviewed the exercise and equipment matches, kept the cue wording original rather than copying source text, and added 30 entries with the required cue and mistake counts. Tests validate the cue counts and missing-ID checker; the seed checks every curated ID against the downloaded library before writing, reports how many entries received cues, and clears stale cue arrays when the JSON no longer contains an exercise. Running the seed twice confirmed the cue arrays remain stable. The session page displays form guidance in a closed-by-default disclosure for each exercise that has cues, with a render test for populated and empty guidance. Formatting, lint, typecheck, and the unit suite passed.

## Shubham

I worked on accounts, access tiers and Stripe test-mode billing, which meant the UI, the application code, the data models and the tests, plus the account policies and the Stripe and local service setup. I used AI mostly to talk through the flow before I built something, to understand parts I hadn't used before, to help me read errors, and to double-check things afterwards. Where it gave me a draft, I treated it as a starting point and went through it and changed it. The entries below are a few representative examples.

### Verified accounts (issue #14, milestone 1)

**Before asking:** I wanted email verification and password recovery in the first login release, with trials and Stripe coming later. We already had Prisma users and fitness relations, so I needed to understand how an auth library would work with that schema before I changed anything.

**Asked:** how Better Auth could fit with our existing Prisma users and relations, and what I should check in the login flow. When the migration failed with P1000, I pasted the error and asked what connection settings or local services could cause it. I also asked why the verification emails showed up in Mailpit and not in a real inbox.

**Got:** a walkthrough of how sessions, verification emails and reset emails fit together in the account flow. For P1000 it gave me things to check, and those checks showed that Docker accepted the credentials while a Windows PostgreSQL service was also running. For Mailpit, it explained that it only catches emails locally and doesn't send them to users.

**Did with it:** I worked through the database and mail setup on my machine and used those checks to understand why the two services were clashing. I read through the account code and revised it, and when something broke I described what I was seeing and asked for help fixing it. I also asked for the backend, screens and tests to go in separate commits so they're easier to review. Mailpit is just for local testing, so real inbox delivery will need an SMTP provider.

### Trials and access tiers (issue #14, milestone 2)

**Before asking:** I'd already decided on a one-time seven-day trial that the user starts without a card. I also wanted the account screens to match FitnessCoach and work on mobile in both light and dark themes.

**Asked:** how to stop repeated trial requests from extending access, and how expiry should affect permissions. I also explained the password flow I wanted for signed-in users: a dialog with current password, new password and confirmation, so they stay on their account page.

**Got:** an explanation of how to approach it, with a rough draft to start from. A conditional database update stops a trial from being activated twice, the server checks expiry on every protected request, and the original trial date is kept so it can't be reused.

**Did with it:** I checked the result against my trial policy. When I tested it, the password flow sent users away from their account, so I described the dialog behavior I wanted and had it corrected. For the UI, I gave feedback on each version, asked for a backup before the redesign, tried it, and decided to go back to the earlier design. Tests cover expiry, concurrent activation and forged input. Feature owners still need to use the shared guards in their own pages and actions.

### Stripe test-mode subscriptions (issue #14, milestone 3)

The billing work lives on its own branch. The sign-in and tiers PR only has milestones 1 and 2.

**Before asking:** I took a backup before touching billing and set up a Stripe sandbox. I'd already decided on monthly and yearly PRO plans, and that they would stay separate from the seven-day trial, which needs no card.

**Asked:** how Checkout, billing management and webhooks should fit with the access tiers we already had. I'd never set up Stripe, so I asked for step-by-step instructions where I got stuck. Once I had a flow, I asked it to look for cases I'd missed.

**Got:** the main thing I took from it was not to trust the redirect after Checkout. PRO should only be granted once the server has confirmed the payment. It also said to refresh the account status when the user comes back from Checkout, and to make sure billing never overwrites trial dates or ADMIN access. When I asked what I was missing, it listed double-clicked Checkout requests, cancellations, renewals and failed payments.

**Did with it:** I configured the Stripe sandbox and wrote down the monthly and yearly requirements. When I tested a payment locally, the displayed tier didn't update, so I asked for a fix, automatic status refresh and clearer startup instructions. I used AI to help run checks and sandbox scenarios for purchase, cancellation and renewal. At the milestone review, 94 unit tests passed, along with formatting, lint and TypeScript checks. This is test-mode billing only, and connecting it to the quiz/session and coach screens is separate integration work.

---

### Signed-in quiz and workout sessions (issue #50)

**Before asking:** I wanted the existing quiz and workout flow to work with real accounts, as the issue describes, so each person only sees and logs their own workouts. I decided to add local demo accounts for all four tiers, including an offline PRO one, so I could test everything without going through a Stripe purchase.

**Asked:** how the signed-in flow should run from login through the quiz, the plan, workout logging and finishing a workout, and then for help building and checking it. While setting up locally I hit three errors and pasted them in: a migration error about the existing `Session` table, a missing Stripe module, and a warning that another dev server was already running.

**Got:** the advice was to check the session on every page and every action, and to look up user data by the user ID from the server, never from anything the client sends. It also suggested returning the tier and trial info with the session. Most of the code for this was written by AI from what I told it, including the demo account seeding and the tests for signed-out redirects and for trying to open someone else's plan. For the errors, it traced the migration problem to a renamed migration history, the Stripe error to a dependency that wasn't installed, and the last one to a dev server I'd left running.

**Did with it:** I decided how the flow and the demo accounts should work. I got the app running locally, fixed the three errors and told it what I saw when something else broke. Near the end I asked it to check the work against every requirement in the issue. The automated checks passed in a clean workspace, including the database and browser tests. I repaired the local migration history after taking a backup, and no app data was deleted. The demo passwords are in my private env file, not in the repo, and the offline PRO account only exists for local testing.

### 14 November 2026, coach-event review corrections (issue #52)

**Before asking:** my PR had an approving review, with five non-blocking comments. I wanted to know which ones I should fix now and which could wait, so I went through them against issue #52 and the existing code and asked for guidance.

**Asked:** whether the review comments matched what issue #52 requires, what the remaining privacy and test concerns were, and how to correct them. I also asked which items were fine to leave as follow-ups.

**Got:** advice on three fixes: keeping chat replies out of the logs, testing for the actual prompt text instead of a column that doesn't exist, and fixing the wording in the README. I also learned that PR #99 is still open, so the cached-outcome migration has to wait on merge order. A fixed error category is future work.

**Did with it:** I made the changes in the code, tests and docs myself, using the guidance as a reference. The sink now stores SQL NULL for chat replies before serialization. The tests now cover chat privacy and check saved records for actual prompt text. All 852 unit tests, TypeScript, lint and formatting pass. I couldn't run the database integration tests because TEST_DATABASE_URL isn't set and the Docker daemon isn't available. I didn't use a development database.

### Storing coach-call records (issue #52)

**Before asking:** I was working on the schema and code for coach-event storage and wanted feedback on whether the structure fit the project. I needed to check my changes against issue #52, understand how they should connect to the existing coach logger, and find out whether any dependency branches were missing.

**Asked:** to check the schema and related code against the issue, point out problems with the relationships, ownership and stored fields, and help with the remaining implementation and tests. I also wanted to understand how to keep prompts out of the database and handle failed writes without breaking the coach response.

**Got:** feedback and help with specific schema, sink and test changes. The main points were to take the owner from the server, include the metadata requested in the issue comment, distinguish unknown token counts from zero, and handle missing JSON values correctly. The review also identified that the pending `cached` outcome would need a matching schema update when it lands.

**Did with it:** I used the feedback while working through the schema and code changes, for implementation, troubleshooting and verification. I kept the work on its own #52 branch. The migration and tests ran on an isolated database: 852 unit tests, 86 integration tests and 17 browser tests passed, along with formatting, lint, TypeScript and the build. The 14 sink cases check storage, separate users, deletion and failures. The setup notes explain how callers should use the sink and what still needs coordinating with the pending coach changes.

### Exercise-coach sign-in and private history (issue #104)

**Before asking:** I wanted to check my assigned issues and whether I needed code from another branch before continuing. The review found that the body-map coach still used the shared demo user after the quiz/session work merged. I chose to fix that privacy issue first and keep it separate from the tier and plan-limit work.

**Asked:** to check the existing flow, use the signed-in account for exercise chat, and test that one person's questions never appear in another person's history. I also wanted to remove the unused shared demo seed without deleting existing users or workouts.

**Got:** help understanding why the exercise coach bypassed sign-in and how the shared demo account mixed users' chat histories, and help with specific code changes and regression tests. The guidance covered where to check the session, how to scope conversations by the signed-in user's ID, and how to test requests that supply someone else's details.

**Did with it:** I chose to fix #104 first and keep it separate from my #51 work. I directed the change to use the signed-in account and asked for checks that users could not share chat history. AI helped implement the changes, write the regression tests and work through the failing checks. I used the results to check the fix against the issue. The shared demo seed was removed without deleting existing data, and the setup docs were updated. The optional four-tier demo logins remain available.

### Coach tiers and plan-request limits (issue #51)

**Before asking:** I wanted to continue my coach-access task after the exercise-chat privacy fix. The older branch already had tier helpers and a cooldown, but it needed to fit the sign-in and Stripe code now on main. I wanted my existing #104 work preserved and the remaining coach-owner integration kept clear.

**Asked:** to check the current branches and requirements, refresh the helpers, and test that expired access or repeated requests cannot reach the model. The policy stays the same: every tier can request a plan, while coach chat needs an active trial, PRO entitlement or ADMIN access.

**Got:** help with specific code changes and tests for fresh sessions, effective tiers and an atomic database reservation. The reservation counts failed attempts as well as successful requests, and concurrent requests cannot both claim the same slot. The review also identified that the general chat route and personalization action are still pending in other coach work.

**Did with it:** I continued with a separate #51 branch, preserving the old commits in a backup and building on the #104 fix. AI helped update the implementation, migration and regression tests. The existing exercise coach now checks the shared tier guard before model setup. The checks passed: 891 unit tests, 91 PostgreSQL integration tests, 17 browser tests, formatting, lint, TypeScript and the production build. The older migration-name recovery was also tested on a disposable database, without using my development database. The documentation explains setup and the remaining callers. I am keeping #51 open until those callers are integrated and tested.

### 20 November 2026, guarded streaming chat integration (issue #51)

**Before asking:** #56 had already merged the streaming library, and the updated #51 description wanted guards on the chat route. Before writing anything, I re-read the issue and my earlier work (up to #107) so I could reuse the helpers I already had.

**Asked:** AI to help me check my understanding of the current code, confirm which pieces already existed, and explain the errors I hit while wiring things together.

**Got:** Confirmation that the tier guards, plan-request reservation and streaming generator were already in place. The missing parts were a streaming HTTP endpoint, since the coach form still called the plain Server Action. When one of my interaction tests failed, AI helped me work out why: the action-state updates held back the visible reply until the whole response finished. That explained the problem, and I fixed it myself by having the form handle the streaming request directly.

**Did with it:** I made the code changes myself on a new branch from main. I wrote the guarded endpoint, reused the action's admission checks, connected the form and added the regression tests. Before opening a stream, the route checks the user's current tier. It loads only the session owner's context and history, and it reports success only after the exchange is saved. The tests cover denied access, trial expiry, ownership, quotas, interruptions, saving and incremental display. I used AI only for debugging and for questions I wasn't sure about. No provider keys or private env values went into the code. The plan-request integration stays with #58, and chat keeps its existing limits and FREE access policy. Database and browser checks are still pending: there's no test database URL configured, and the local database rejected the configured credentials. I didn't change any dev database or env file.

## Farnaz

### 8 November 2026, progress logic (issue #16)

**Before asking:** I designed the progress page: two weekly streaks (active weeks and goal met), a body map of muscles worked, and a count of how many workouts used each muscle. Plan days have no dates, so streaks count workouts per week.

**Asked:** how a streak should handle the current week before it ends, which calendar day a late-evening workout belongs to, and whether stretches should count toward muscles worked; and tests for functions.

**Got:** keep the current week from breaking a streak until it's over; compute days in Toronto time because workouts are stored in UTC; skip stretching and cardio when counting muscles. Plus 28 tests.

**Did with it:** reviewed each function against my design, ran tests, lint, typecheck and Prettier locally, and chose to leave runs out of the muscle-share total so the percentages describe strength work. After Nabeegh's review I added tests for daylight saving, workout order, other lifting categories, workouts without a plan and ties in muscle share, so there are now 33.

### 12 November 2026, progress photo storage (issue #16)

**Before asking:** I chose Cloudflare R2 for photos (D3). Phone photos carry GPS data, so I proposed on #16 to upload through a Server Action that removes it, instead of a signed upload link; Nabeegh and Shubham agreed.

**Asked:** I had never set up R2, so I asked for step-by-step instructions with explanations so I'd understand each step. I also asked for the initial code and tests for the new files, based on the design I had in mind: the storage module, photo processing, upload and delete actions, and the page. I wasn't sure how to set up 5-minute signed links, so I asked for guidance on that, and for a list of checks for the UI and R2 so I wouldn't miss anything, on top of the checks I had planned myself.

**Got:** step-by-step instructions and explanations that cleared up my doubts; the initial code for those files, including the 5-minute signed links; 77 tests; and a checklist for testing.

**Did with it:** followed the instructions to set up the private R2 bucket and its key, reviewed the generated code to make sure it met our project requirements, ran tests, lint, typecheck and Prettier locally, and went through the checklist on localhost: upload, rejected files, delete, an expired link and signing out. I also left body measurements as a suggestion on #16, since they need a schema change. After Shubham's review, I had the delete order changed so the R2 file is removed before the database row, and a failed file delete now shows "Try again" instead of hiding the photo. The updated failure test and a new retry test were AI-generated; I checked them and reran the suite, so there are now 78 tests.

### 12 November 2026, profile photos (issue #16)

**Before asking:** Shubham asked me to handle profile photos since I had built the photo storage functionality. I wanted users to have a round profile picture and be able to adjust its framing, similar to what other apps offer. I also wanted users to be able to edit an existing photo without uploading it again.

**Asked:** I first explored how to implement an interactive image crop editor in React, including which libraries support dragging and zooming. I asked about using `react-easy-crop` and how it could fit into our existing photo storage and processing setup. I also asked how to preserve the original image so users could change the crop later, and how to handle upload, update, and removal securely. After discussing the approach, I requested implementation examples and tests for the account page and related actions.

**Got:** An implementation approach using `react-easy-crop`, with drag-and-zoom controls, upload/edit/remove actions restricted to the signed-in user's profile photo, and a way to retain the original image alongside the cropped version; as well as 65 tests covering the new functionality.

**Did with it:** Reviewed the implementation and checked that it reused our existing storage and photo processing modules. Ran tests, lint, typecheck, and Prettier locally, then tested adding, changing, editing, and removing a photo on localhost, including uploading a non-image file. Checked R2 to verify that both the original and cropped images were stored correctly and that both were deleted when a photo was changed or removed. When the editor initially opened blank, I investigated the issue and traced it to a photo uploaded before original-image storage was introduced. This meant the issue was limited to older photos and did not affect newly uploaded ones. I also found that a non-image file opened a blank editor, and asked for a check before the editor opens.

### 13 November 2026, review fixes for photos and profile photos (issues #16, #109, #110)

**Before asking:** Nabeegh reviewed #109 and #110 and left comments about upload size, ownership checks, error logging, photo limits, accessibility, and tests. I wanted to address the feedback while keeping uploads flexible for users.

**Asked:** How to address each review comment, including handling large phone photos under Vercel's 4.5 MB request limit and preventing two tabs from overwriting each other's profile photo.

**Got:** Implementation examples and suggestions for browser-side image resizing (up to 50 MB), ownership checks, error logging, a 1,000-photo limit with a paginated gallery, accessibility improvements, and handling changes across tabs. AI also generated tests, including photo editor interaction tests using jsdom and Testing Library.

**Did with it:** Reviewed the suggestions and implementation, decided to keep the upload and photo limits generous, and added notes to the page explaining them. Ran tests, lint, typecheck, and Prettier locally. Tested large photos, non-image files, error handling, and the two-tab case on localhost. Found and fixed an issue where an edit in one tab could overwrite a photo saved in another. Checked R2 for leftover files.

### 13 November 2026, progress page (issue #16)

**Before asking:** I designed the progress page around the workout logic from #82. My plan was to include a calendar of completed workouts with each day's details, two weekly streaks, a body map showing which muscles were trained during the month and how often, and the latest progress photos. I also wanted the page to be mobile-friendly and consistent with the account page's dark mode.

**Asked:** How to structure the page and its components based on my design, how to implement hover labels for the body map, and how to create realistic demo workout data to test the page. I also asked for implementation examples and tests for the components.

**Got:** Example implementations for some page components, a demo data script, guidance and code for the body map's hover labels, and tests for the page. The dark mode approach reuses Shubham's existing theme toggle and requires a shared change in `globals.css` to keep colours consistent across pages.

**Did with it:** Reviewed the implementation against my original design and the #82 workout logic. Ran tests, lint, typecheck, and Prettier locally. Tested the page on localhost using the demo data, including the calendar, daily details, body map hover labels, page links, dark mode, and mobile layout. After Nabeegh's and Shubham's reviews, I had the pace display fixed so it can't show "5:60 /km", and photo storage errors on the progress page are now logged. The fix tests were AI-generated; I checked them and reran the tests.

### 21 November 2026, navigation bar, shared light and dark theme, session body map

**Before asking:** I started testing the live app and found several usability and consistency issues. After signing in, users land on `/account` with no links to other pages. Clicking the logo sends signed-in users back to the home page, which still displays Sign in and Create account, making it look like they have been logged out. The app also uses two different names, FORM and FitnessCoach. I noticed that the session page had no dark mode while other pages handled themes separately. I wanted to address these issues with a shared navigation bar and a unified theme across all pages. I also found that some muscle spots on the session page's body map were outside the body diagram, so I proposed reusing the diagram from the progress page for consistency.

**Asked:** How to structure a shared navigation bar for signed-in pages, handle home page navigation based on authentication status, and introduce one shared light and dark theme. I also explored options for fixing the session body map and asked for implementation examples and tests.

**Got:** Implementation examples for a shared navigation component with the user's profile badge, a unified theme file (moved from `progress-theme.module.css` to `theme/app-theme.module.css` and renamed to `appTheme`), a home page that redirects signed-in users and uses Get started as its main action, and a session body map using `react-muscle-highlighter`. AI also generated tests for the changes.

**Did with it:** Reviewed and adapted the suggested implementations to fit the existing project structure. Chose FitnessCoach as the single app name and kept the account page's own controls. Ran tests, lint, typecheck, and Prettier locally, then checked every page on localhost in both light and dark modes, including navigation and signed-in user flows. Discussed the session body map change with Mohammad, got his approval, and then implemented the fix.

### 22 November 2026, coach stream fix (#123, #124), Why this plan follow-ups (#126), Personalize with the coach (#58)

**Before asking:** Farnaz and Mohammad reported on 21 Nov that the coach on the live deploy showed the "can't answer" line above a reply, logged `coach: stream failed unknown`, and returned 429 after a few tries. I wanted the cause found before the freeze, not guessed: provider, keys, Vercel limits, or our own code.

**Asked:** To reproduce the failure locally with the deploy's provider order, trace where an error without a code could be thrown after a successful save, and write a regression test before any fix. Then to apply Mohammad's two #88 review follow-ups, and to build the #58 action in the order Shubham asked for on #51.

**Got:** Local probes showed Groq and Gemini answering normally. A throwaway route under `next dev` showed that `revalidatePath` throws `Invariant: static generation store missing` inside the response stream's `pull`, after the exchange is saved; the 429 was our own 5-a-minute chat limit. AI drafted the regression test (red on main), the one-line removal, the #88 changes with tests, and the #58 modules (a pure `personalizePlan` with injected steps, an input loader, the Server Action, a button) with tests written first.

**Did with it:** Checked the Next source for the invariant, ran each new test against main's code to see it fail, ran lint, typecheck and the full unit suite locally, and had a separate review agent read each change blind before pushing; its findings (a leaking console spy, a test that passed on main too) were fixed. The fix is in #124 for Shubham's review, the #88 follow-ups in #126 for Mohammad's, and the Personalize button is left for Mohammad to place on his plan screen.

## 22 November (evening): repeated set save test, demo risk check

**Asked:** To check which demo flows are on main and on the live deploy, and to prove that saving the same set twice stores one row (#42).

**Got:** A flow-by-flow risk table from code, the live pages and teammates' comments, and three integration tests in `tests/integration/quiz-session.test.ts` (PR #128). AI drafted the tests; they pin behaviour `logSet` already has, so they pass on main.

**Did with it:** Read `logSet` and the schema to confirm each assertion, had a separate review agent read the diff blind (it found no error and suggested a weight assertion, which I added), ran Prettier, ESLint and the type check, and let CI run the integration suite. Two taps in flight at once are not covered; that is noted for Mohammad on #15.

## 22 November (late afternoon): board audit and the first step of the fatigue deload

**Asked:** To read every open issue and pull request against the board and main, close the issues whose boxes are all met, put the merge order in order, and start the enhancement with the most demo and grading value.

**Got:** A table of 19 issues and 9 pull requests with their true column, supported boxes, owner and blocker; three issues closed with dated comments (#11, #72, #66); the merge order with a check per pull request; and, for #93, decision D21 (two signals must agree, thresholds marked unverified) with a pure `proposeDeload` function and nine unit tests written first. AI drafted the test file and the function.

**Did with it:** Checked each issue's boxes against main with `git grep` and `gh` instead of the issue text, ran each new test against the missing module to see it fail, then ran lint, the type check, format check and the full unit suite (1,654 tests), and had a separate review agent read the change blind before the push. The deload screen where a user accepts or declines is a follow-up; this change is the rule only. The review agent found no error; its should-fix items (the wording of D21 and its source, four extra tests, the pull request saying Refs and not Closes) were applied.

**Tools:** gh, git, Prettier, ESLint, tsc, Vitest, one general-purpose review agent. No skills or connectors.

## 22 November (evening): importing workouts from a Hevy export

**Asked:** To let a user bring their history from the app they already use (a Hevy CSV), with the sessions marked as imported and never counted as logged live in FitnessCoach (#131).

**Got:** A column and date-format spec with sources (`docs/IMPORT_FORMATS.md`), decision D22, and the code: a small CSV reader, a date reader for Toronto time, a Hevy parser with unit conversion, name matching to the library with a user mapping step, a save that skips workouts already imported, an Import page, and an "Imported" label and count on Progress. AI drafted the parsers, the tests and the page.

**Did with it:** Read the Hevy and Strong help pages myself and found they publish no column list, so the columns come from third-party importers and are marked unverified in the doc; refused ambiguous dates instead of guessing day-first or month-first. Wrote each test before its code and ran lint, the type check, the format check and the full unit suite (1,711 tests). Two separate review agents read the change blind: the first found three errors (a test that sorted numbers as text, two file names mapped to one exercise breaking a unique key, names like `constructor` breaking the mapping) and nine smaller points, all fixed; the second found no error. The integration test could not be run locally because there is no Docker, so CI runs it.

**Tools:** gh, git, Firecrawl (search, scrape, developer search), Prettier, ESLint, tsc, Vitest, two general-purpose review agents. No skills.

## 22 November (evening): bugs found on the live site

**Asked:** To fix what I found using the live app with a trial account: a coach reply cut off mid-sentence and saved that way, replies that were too long and added safety and nutrition lines nobody asked for, a quiz that reset to its defaults after saving, a starter plan for an experienced full-gym user with no barbell lift, a coach panel saying the coach was not live, and times shown in UTC.

**Got:** Nine issues with the live evidence (#137 to #145) and four pull requests: a note on replies that stop at the token limit and shorter prompts (#146), the quiz showing its saved answers and stating the strength and run split (#148), a starter plan that uses the user's level and equipment (#149), and the copy, local time and weight hint fixes (#150). AI drafted the tests and the changes.

**Did with it:** Wrote each failing test before its change, ran lint, the type check, the format check and the full unit suite on each branch, and had a separate review agent read each branch blind before it was pushed. The reviews found real faults that I fixed: a quiz form that still reset after a second save with the same message, a note that could be saved as the whole reply, and extra accessory choices that put an overhead press on a pull day. Not done: eval cases for the reply length (#142 stays open), the starter plan's warm-up, supersets, cardio and deload week (#145 asked for them), and a separate strength-days and run-days question (#143).

**Tools:** gh, git, Prettier, ESLint, tsc, Vitest, four general-purpose review agents. No skills.

## 22 November (night): a study guide for the Q&A

**Asked:** For one document I can use to answer any question from the instructor and TAs on 4 December, written for listening: the app in 60 seconds, one user journey, every component with why and how it fails, who built what, the course's Q&A topics with a short answer first, fifteen follow-ups, the plan to 6 December and a glossary.

**Got:** `docs/STUDY_GUIDE.md`, read from the code on main rather than from the docs alone, with a table of the open pull requests that change an answer once merged. AI drafted the text from the files I pointed it at.

**Did with it:** A separate review agent that had not seen the draft checked every claim against the code, the docs and `gh`. It found five errors, which I fixed: the coach does not read logged sets, the plan-request limit lives on the user row, the order of checks in the coach route, the test file count (109), and that retries and demo mode apply to plan calls, not to streamed chat. It also found overclaims that I corrected: model-written plans and the deload rule are not on main yet, and the double-tap save error is suspected, not reproduced. The changed lines were re-read by me only, with no second agent pass.

**Tools:** gh, git, Prettier, one general-purpose review agent. No skills or connectors.

## 23 November (evening): freeze night, reviews and the live fixes

**Asked:** For a last pass before the feature freeze: update my open pull requests with main, have each read blind by a separate review agent, review Mohammad's #152 and re-check #121 and #122, and fix the bugs I hit at the gym on the live site on one branch.

**Got:** Blind reviews of #146, #147, #148, #149, #98, #130 and #127, and a branch of fixes for the live bugs: the coach's Markdown shown as elements instead of asterisks and table pipes, a follow-up like "What about head and neck position?" kept in context, tension answered with form cues while sharp pain still stops and refers, advice told to follow the plan's sets and reps, and a test that the start time shows the viewer's hour when the server runs in UTC. AI drafted the tests and the changes.

**Did with it:** Wrote the failing test first for each change, ran lint, the type check, the format check and the full unit suite, and had a review agent that had not seen the work read the branch before the push. The reviews of my open pull requests found real faults, which I fixed on their branches: a header with a million columns could keep the server busy for over a minute on the Hevy import (#147), a deadlift was ordered with the light work in the starter plan (#149), and a comment on #98 said the chat path supplies a value that nothing supplies. I took a change to Mohammad's body-map prompt out of #146 and left a note for him instead. #127 waits until after the freeze. Not done: the starter-plan fixes for equipment-poor main lifts, and the other should-fix items listed on each pull request.

**Tools:** gh, git, Prettier, ESLint, tsc, Vitest, review agents (pr-review-toolkit code-reviewer, one per pull request and one for the fix branch). No skills.

## 23 November (evening): rehearsal of the live demo

**Asked:** For a written click path of the live demo with what the audience must see and a fallback per step, and a walk of every step on the live site, so the demo runs clean at the 24 November rehearsal and on 4 December.

**Got:** `docs/DEMO_SCRIPT.md`, and two issues with a `demo-blocker` label from the part of the walk that needs no account: the top menu is cut off at 1280 x 720 (#153) and text under 14 px on sign-in, sign-up and the session screen (#154). AI drafted the script from the code and the slide plan.

**Did with it:** A separate review agent that had not seen the draft checked it against the code and found three errors that I fixed: "Why this plan" is not on any screen on main, the quiz is reached from Edit profile and shows a saved message with a link rather than the plan, and the cached plans do not back the chat step. I also fixed the backup step numbers, the missing Start workout click and the 4:40 cut. The changed lines were re-read by me only. The signed-in walk, the timings and the seed account are not done: creating the demo account's mailbox was refused, so they wait on that.

**Tools:** gh, git, Prettier, Playwright, one general-purpose review agent. No skills.

## 24 November (evening): weight hint for more equipment (#144)

**Asked:** To finish the part of #144 that was left: the KG field hint for foam roll, exercise ball, bands and "other" exercises.

**Got:** A change to `src/lib/workout/weightPlaceholder.ts` and its test. Foam roll shows Bodyweight; bands, exercise ball and "other" show "Optional kg"; everything else except body only still shows "Load in kg". The equipment values were checked against the free-exercise-db file on 24 November. AI drafted the code and tests.

**Did with it:** The two new tests failed before the change. A review agent that had not seen the draft found that two exercise-ball moves are weighted and that the first hint text would be cut off in the narrow field; both fixed.

**Tools:** gh, git, Prettier, ESLint, tsc, Vitest, one review agent. No skills.

## 24 November (evening): photo enlarge and the body weight log

**Asked:** For two Progress page features under #16: clicking a progress photo opens it full size in an accessible dialog, and a body weight log (date, kg, optional note) with a line chart. Design first in `docs/ARCHITECTURE.md`, tests first, no new dependency.

**Got:** `PhotoViewer` on the Base UI dialog already in the project, mounted in the Progress strip and the gallery. Decision D24 (a new `BodyWeight` table, one row per user per day, rather than reusing the photo's weight column), migration `20261124190000_add_body_weight` with CHECKs, the `logBodyWeight` Server Action, the form and a small SVG chart. AI wrote the code and tests from my brief.

**Did with it:** Each change went through a review agent that had not seen the work. The photo review found three errors, which were fixed test-first: the dialog left the dark theme, a long note could not be reached on a phone, and the focus trap had no test. The weight review found the chart caption printing values like 63.099999999999994, and that a refused entry wiped the form. A second agent checked each fix. Lint, type check, format check and the targeted tests ran before each push, and CI was green on the exact commit before it reached main.

**Tools:** gh, git, Prettier, ESLint, tsc, Vitest, Prisma (validate, migrate diff), review agents (pr-review-toolkit code-reviewer, a blind pass and a delta check per change). No skills.

## 24 November (evening): logging a run by hand

**Asked:** For a way to record a run without a watch link. My test that day showed that a plan with an easy run had nowhere to log the run unless a session was started first. The brief: a form on the Progress page (day, km, h:mm:ss, optional effort and note), the pace shown, the latest five runs listed, and the plan's run day marked done. Design first, tests first, and the session screen left to its owner.

**Got:** Decision D27. A run is a finished `Workout` plus its `RunLog` row (the table already existed, with checks, but nothing wrote to it). This beat a new table and beat the workout row alone. Plan days are a rotation, not dates, so the run completes the plan's next day when that day is a run. Also: the `logRun` Server Action, the form and list, migration `20261124200000_run_log_upper_bounds` (300 km, 24 hours), and a Postgres integration test. AI wrote the code and tests from my brief.

**Did with it:** Each new test failed before the code existed. A review agent that had not seen the work read the change and found no errors and three should-fix items. The day view showed a made-up noon start time, a two-hour run showed as 125:30, and a save racing Start on the session screen could take a plan day twice. The first two were fixed test-first; the race is written into D27 as a known cost, with a note for the session screen's owner. A second agent checked the fixes. Lint, type check, format check and the targeted tests ran before the push, and CI was green on the exact commit before it reached main.

**Tools:** git, gh, Prettier, ESLint, tsc, Vitest, Prisma (validate), review agents (pr-review-toolkit code-reviewer, a blind pass and a delta check). No skills.

## 24 November (evening): saved coach replies for the live demo

**Asked:** For the last code gap on #59 before the 4 December demo: when demo mode is on and both model providers fail or time out, the coach answers the scripted demo question with a stored reply, marked on screen as a saved example and never shown as live, still passing the reply check, and never used outside demo mode. Design first, tests first.

**Got:** A design note under D12 in `docs/ARCHITECTURE.md` (where the replies live, how they are keyed, how they are kept honest, and the options it beat), `src/lib/coach/demoReplies.ts` with its JSON file, a recording script `scripts/demo-replies.ts`, a new `example` event on the chat stream, and the label "Saved example, not a live reply" in the chat screen's notice. The three stored replies are real coach replies to the three quick replies, recorded once through the normal chat pipeline (three Groq calls). AI wrote the code and tests from my brief.

**Did with it:** Wrote the failing tests first for the stream, the route, the client protocol, the form and the notice, and checked one later test by reverting its line of code. Lint, the type check, the format check and the coach tests (1,186) passed before review. A review agent that had not seen the work found no error. It found one test that could not fail: it checked the live reply bubble after the bubble was already gone, so it now watches every change on the page and fails when the stored reply is made to show in the bubble. It also found that the stored reply to "Swap this exercise" is a question back, so the demo script now taps "Too easy". A second agent checked those fixes. Not done: the network-off rehearsal and the verified demo account (#59), and the "Too easy" reply's claim that a cable face pull uses the same equipment as a dumbbell raise, which passes the checks but is loose.

**Tools:** gh, git, Prettier, ESLint, tsc, Vitest, tsx (one recording run), review agents (pr-review-toolkit code-reviewer, a blind pass and a delta check). No skills.

## 24 November (evening): the coach turning away a workout question

**Asked:** Why the coach sometimes answered "explain one of the workouts for me" and sometimes did not. The brief: find which path ended each failed turn before changing anything, then fix the top cause test-first.

**Got:** A diagnosis run first. Production records could not be read from this machine, so the real chat pipeline was run six times on the same question with a sample profile. All six turns got the off-topic redirect before any model call, so they left no coach record. The training word list held "workout", "exercise" and "weight" only as whole words. "Explain today's workout" was answered and "explain one of the workouts" was turned away, so to a user the answer looked random. The fix adds a second list of plural and verb forms ("workouts", "exercises", "exercising", "weights") that only keeps a message out of the off-topic redirect, leaves out "plans", "work out" and "routine" as too loose, and records the rule in the architecture doc. AI wrote the diagnostic run, the test cases and the pattern change.

**Did with it:** Five new allow cases failed before the change and pass after it; four redirect cases and three check-in cases guard the boundaries. The targeted coach tests, lint, type check and format check ran before review. A review agent that had not seen the work found two problems. The first version put the new words in the main training list, so a message such as "I want to give up on my workouts" lost the check-in that names 9-8-8 and went to the model. It also let "work out a time for dinner" through. Both were fixed test-first (five new cases failed before the fix), and a second agent checked the fix.

**Tools:** git, gh, tsx, Vitest, ESLint, tsc, Prettier, review agent (pr-review-toolkit code-reviewer). No skills.

## 24 November (evening): checking the advanced-features section

**Asked:** Which advanced features the repo really has, with the demo path and the failure path of each, and anything that would look wrong to a marker.

**Got:** An audit that read the proposal, the architecture doc, the plan and the code for sign-in with tiers, the coach, streamed replies and photo processing. The architecture doc still listed notifications, a then-vs-now photo image and Redux Toolkit as planned, and none of them exist. AI rewrote that section to say what is built and what is not claimed.

**Did with it:** Checked each claim against the code (the tier check in the coach route, the sentence-by-sentence stream, the sharp resize that drops location data). The targeted tests for those areas (33 files, 375 tests) pass; no browser run was possible.

**Tools:** git, Vitest, Prettier. No skills.

## 24 November (evening): workout history

**Asked:** Why a past workout cannot be opened from the live Progress page, the smallest fix for that, and a workout history: a paged list, a page for each workout that only its owner can open, and if time allowed, a page for each exercise over time.

**Got:** A diagnosis from the code and the Next.js 16 documentation bundled with the project. On a phone the tapped day's details render under the calendar, and a link keeps the scroll position, so the change happens out of sight. A workout card also had no link. Decision D29: calendar days link to the details' heading, each workout card links to its page, and three new routes: `/history`, `/history/[workoutId]` and `/history/exercise/[exerciseId]`. Every lookup filters on the signed-in user, and a miss answers 404.

**Did with it:** Wrote the failing tests first (loader queries, the pages' 404s, the new links), then the code. Ran lint, the type check, the format check and the affected tests. A review agent that had not seen the work read the branch before the pull request was marked ready. The integration test for owner-only access runs in CI. There was no live browser check, because the local database was down.

**Tools:** gh, git, Prettier, ESLint, tsc, Vitest, Next.js bundled docs, review agents (pr-review-toolkit code-reviewer). No skills.

## 25 November: live-site polish from the 24 November feedback (items 2, 3, 5, 8, 9)

**Asked:** Five fixes from the feedback on the live site, one commit each and tests first: the rest timer starts when a set is logged, the coach panel under Explore by Muscle shows its chat box on open, the progress photo opens near full screen (#159), the Hevy import says what it did after Import, and more Hevy exercise names match the library.

**Got:** A small helper that works out the rest time left after a set (`src/lib/workout/restRemaining.ts`), so a reload an hour later does not restart the timer; a Skip rest button. The body-map panel opens the first exercise of a picked muscle, so the question box is there at once. A photo dialog of 96% of the viewport. A result panel after Import that takes focus and lists what was left out and why (`src/lib/import/report.ts`). A spelling-tolerant name key and a 36-name alias table (`src/lib/import/matchKey.ts`, `aliases.ts`); on one real 260-workout export the names with no library match fell from 51 of 80 to 6.

**Did with it:** Wrote the failing test for each item first and watched it fail for the right reason. Checked every alias target against the exact names in the free-exercise-db file fetched that day (876 exercises), and checked that no name that matched before moved to another exercise. The export itself was used only as a local input and none of its rows are in the repository; the fixtures are made up. Unmatched names are still listed for the user to map, because a wrong automatic match would put sets under the wrong exercise. The cause of the page "silently resetting" after Import could not be reproduced here; the panel now takes focus so the result cannot be missed.

**Tools:** git, gh, Vitest, ESLint, tsc, Prettier. No skills.

## 25 November: evidence map and live database check for the presentation

**Asked:** A table that ties each line of the presentation rubric to what we show live, the file and database table behind it, and a fallback; a read-only script that shows the newest set and photo rows so the presenter can prove a save in the database; a 90-second demo script.

**Got:** `docs/demo/DEMO_EVIDENCE.md` and `docs/demo/DEMO_SCRIPT.md`, and a script (`scripts/demo-db-peek.ts`) that runs its queries inside a read-only transaction. A first version printed the first line of a database error, which can hold a host or user name; a review agent that had not seen the work caught that and a missing test of the read-only guarantee.

**Did with it:** Checked every file and model named in the table exists on main. Wrote the script's tests first and watched them fail; added a test on a real PostgreSQL that sends only read statements and fails when the read-only line is removed. Ran the script against a scratch database to confirm a write is refused. The signed-in steps on the live site were not rehearsed because no demo account exists, and the script has not been run on the production database.

**Tools:** git, gh, Vitest, Prettier, ESLint, tsc, Playwright (public pages only), Docker (scratch PostgreSQL), review agents (pr-review-toolkit code-reviewer). No skills.

## 25 November: Sign in with Google

**Asked:** Let people sign in with Google so they do not have to create an email and password account, working for the 26 November demo; email and password stays, and the four tiers keep working.

**Got:** Decision D32 and Better Auth's Google provider, switched on only when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` exist (otherwise the app runs as before and the button is hidden). A Google email that matches an existing account is linked only when that account's email is already verified and Google reports it verified; a Google identity with an unverified email creates no user. New Google users get the FREE tier. A "Continue with Google" button above the email form on the sign-in and sign-up pages, using Google's own G file, and `docs/GOOGLE_OAUTH_SETUP.md` with the console steps. Creating the Google client and setting the two variables in Vercel are done by hand.

**Did with it:** Read the Better Auth Google and account-linking docs (v1.7.15, the project pins 1.7.14) and the installed linking code, and Google's branding and console help pages, all on 25 November. Wrote the tests first and watched them fail: the callback test runs the real Better Auth handler against PostgreSQL with only Google's token endpoint faked; turning off the verified-email rule makes the linking test fail. A review agent that had not seen the work found no error but pointed out that an unverified Google email still created a user and sent a verification email; that is now refused, with a test written first. Not done: a click-through of the real Google consent screen (no client exists yet) and a test of the sign-in page's error handling on its own.

**Tools:** git, gh, Vitest, Playwright spec (runs in CI), ESLint, tsc, Prettier, Context7, Firecrawl (Google help pages), review agents. No skills beyond reading Better Auth's docs.

## 25 November: units preference (kg or lb, km or mi)

**Asked:** A setting for pounds or kilograms and miles or kilometres, with every logged value stored in one unit, shown and typed in the chosen one, and the Hevy preview following the setting.

**Got:** Decision D30: weights stay in kilograms and distances in kilometres in the database; two new `User` columns (default pounds and kilometres) say how they are shown. Pure conversion helpers, a settings action and a toggle on the account page, and the session, Progress, photos, history and import screens changed to follow the setting. Forms send the unit they displayed, and the server converts typed pounds and miles back before the existing checks.

**Did with it:** Wrote the failing tests first (the conversion helpers, each action, the display of each screen) and checked that they failed without the change. Looked up the pound and mile factors in NIST SP 811 Appendix B.8. A review agent that had not seen the work found one real fault: the saved-run form showed miles to two places, so saving it unchanged turned 10 km into 9.99 km. It was fixed test-first and a second agent checked the fix. Lint, type check, format check and the unit tests pass; the migration from empty runs in CI. No live browser check.

**Tools:** git, gh, Prisma, Vitest, tsc, ESLint, Prettier, review agents. No skills beyond the migration-safety guide.

## 25 November: live-site bugs from the audit (B1 to B6)

**Asked:** Fix six faults found on the deployed site: absurd workout durations, a 0.02 kg set, coach replies cut off, a follow-up question refused as off-topic, a Sign out button invisible in light mode, and two theme toggles on the import page.

**Got:** One commit per fault. Durations come from one helper: start to finish only, a run uses its own recorded time, and a workout left open longer than six hours reads "Not timed" (history, Progress and the session screen). A set weight under 0.25 kg is refused with a message that names the minimum. The streaming reader keeps a last server-sent event that has no newline after it. A short question made only of technique words and words of the coach's last reply is no longer refused. Sign out takes its colours from the account tokens with the app foreground as fallback (the global `--muted` is a near-white background). The import page no longer passes a second theme toggle to the nav.

**Did with it:** Wrote each failing test first and watched it fail. A review agent that had not seen the work found no errors and five should-fix points; the session screen showing a different run time from history, a zero-length imported workout reading "1 min", and the weight message and input minimum were fixed test-first.

**Limits, said plainly:** The cause of the 0.02 kg set was not found in the import or units code, so the change blocks new entries only; the existing row stays as it is. The cut-off replies are fixed for a body that ends without a newline; that this is what happened live is not confirmed. The off-topic fix widens a word-list rule and does not reproduce the live thread. The six-hour and 0.25 kg limits are my choices, not measured. No live browser check.

**Tools:** git, gh, Vitest, tsc, ESLint, Prettier, review agent (pr-review-toolkit code-reviewer). Skill: systematic-debugging.

## 25 November: logging sets without a connection (D31)

**Asked:** A user who loses the connection in the middle of a workout must not lose sets, and it has to be shown in the demo: sets logged offline wait on the device, sync when the connection returns, and a replay or double tap never stores a set twice.

**Got:** A design recorded as D31 in `docs/ARCHITECTURE.md` before any code: a queue of logged sets in IndexedDB (localStorage when IndexedDB cannot open), each with a `clientId` from `crypto.randomUUID()`, replayed oldest first on page load, on the browser `online` event and after each new set, one replay at a time under a Web Lock. On the server a new action, `syncQueuedSet`, answers "already saved" for a known `clientId` and otherwise upserts the set and records its key in a new table, `QueuedSetKey`, in the same transaction (an additive migration). The first version kept the key in one column on `SetLog`; an independent review found that a late replay of an older edit could then overwrite a newer one, so every key is now kept. A status pill in the session view says Offline, Saved offline with N to sync, Syncing, or All sets synced, and the set list, the next set number and the rest timer include the queued sets. Service-worker Background Sync was considered and not used: MDN lists it as Limited availability (Chrome only), checked on 25 November.

**Did with it:** Wrote the tests before the code and watched them fail: the queue's order, persistence and failure rules, the pill, the form, the server action against PostgreSQL (a replay and two copies arriving at once each leave one row; another user's workout, a finished workout and a reused key are refused), and a Playwright test that turns the browser offline, logs two sets, turns it back online and checks the database holds each set once. Two mutation checks on the final server code: without the stored key, 7 of the 18 server tests fail; without only the early key lookup, 1 fails, because the key's primary key still rolls a replay back inside the same transaction. While building, I found that waiting for the network before the form could take the next set would block logging on a weak signal, so the form now waits only for the device to store the set. The review also found that a request with no answer was neither shown nor retried, that a set saved just before Finish workout came back as failed, and that the form no longer worked before the page was interactive; each was fixed after a test that failed first. When the teammate pain-score feature (#92) landed on main the same afternoon, queued sets were made to carry the pain scores and the server applies the same stop rule. Added an optional offline step to `docs/DEMO_SCRIPT.md` with the DevTools clicks.

**Tools:** git, gh, Vitest, Playwright, ESLint, tsc, Prettier, Prisma; MDN pages read on 25 November. Skills: idempotency and side effects, Prisma migration safety.

## 25 November: imported history counts, and the app learns how the user trains (D36)

**Asked:** The user said they were no longer a beginner and that the app should know their weights, how long they have trained and when they train. Imported workouts had been kept out of the streaks, so the Progress page showed a short streak for someone with years of history.

**Got:** Decision D36 in `docs/ARCHITECTURE.md`, written before any code, reverses the streak rule of D22: imported workouts count toward both weekly streaks and the cards say so. A training profile is worked out on read from every finished workout, imported or live, and never stored (no migration): the first workout, workouts a week over the last 8 weeks, the usual start hour, the equipment on weighted sets, a working weight per exercise (the heaviest-by-estimated-1RM set of 1 to 10 reps in the last 8 weeks, Epley formula) and an experience level. Progress shows "Training since <month year>, N workouts a week, usually around <time>". The quiz pre-fills experience (never lower than the saved answer) and equipment, with a note, and the user can change both. The weight box on the set form starts at the working weight, with a "Lifted lately" note. The coach prompt gets a short summary, not rows. Plans store no load, so a starting weight is that pre-fill and the summary, not a new column. Level thresholds: 6 months, 13 of the last 26 weeks active and 2 workouts a week for intermediate; 24 months, 20 weeks and 3 a week for expert. Only the 6 months comes from a source (ACSM position stand, 2009, read as excerpts on 25 November; the full text was not opened); the rest are our choices and are named constants.

**Did with it:** Wrote the tests first on invented histories (never a real export) and watched them fail: 8 test files could not load their modules and 11 tests failed on missing behaviour. A review agent that had not seen the work found real faults, fixed after a failing test each: a new user's rate was divided by 8 weeks, a workout at 23:30 and one at 00:30 pulled the usual hour to midday, "months since" used UTC dates while everything else used Toronto, and a set read had no stable order. A second agent checked only the changed lines. My own mistakes the tests caught: pounds showed 134.99 instead of 135 (wrong rounding helper), and the quiz note appeared when nothing had changed. The coach prompt version stays chat-v5 on purpose (the demo reply cache is keyed on it); that is stated in D36. The style hook in this environment flagged number literals in test files and old lines; repo lint does not, so they were left. No live browser check; the imported history of a real account was not read.

**Tools:** git, gh, Vitest, tsc, ESLint, Prettier, Firecrawl (search for the ACSM and Epley sources), review agents. Skill: the Prisma query-discipline guide was not loaded; the read was checked by hand for user scoping and bounds.

## 25 November: competitor research (JEFIT, Hevy, Google Health, JuggernautAI)

The program model needed evidence before the template and coach work, so I read each app's own pages: JEFIT's FAQ and logging page, Hevy's help centre, feature pages and App Store listing, Google's Health Coach help and developer pages for Fit, Fitbit and Health Connect, and JuggernautAI's home, pricing and App Store listing. Every page was read on 25 November and is dated in `docs/COMPETITORS.md`, which holds one table (feature by app, a source key in every cell), what FitnessCoach takes, and what it does differently, each line tied to an issue or task. Reviews and the apps' own comparison articles were left out as evidence. Findings that changed the plan: JEFIT already combines editable library plans with an adaptive 12-week plan, Hevy's Trainer says it is rule-based and not AI, and Hevy's camera overlays the last progress photo for matching the pose, which the camera task now takes. Google Fit's APIs and the Fitbit Web API are being retired, so we do not integrate with them. I recorded the program-model direction as D35 in `docs/ARCHITECTURE.md`. Limits: vendor claims, not tested in the apps; some cells come from search excerpts (marked in the sources table); JuggernautAI's FAQ answers did not load; Strong and Fitbod were not covered; Firecrawl credits ran out partway, so three pages were read with a plain fetch.

**Tools:** Firecrawl (search, scrape), a plain page fetch, git. Skills: none beyond the task file.
