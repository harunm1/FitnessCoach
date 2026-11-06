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

**Before asking:** I took a backup before adding billing and set up a Stripe sandbox. I decided on monthly and yearly PRO subscriptions, kept separate from the cardless app trial.

**Asked:** how Checkout, billing management and webhooks should work with our existing access tiers. I was also unsure about parts of the Stripe setup, so I asked for detailed instructions, and I asked for a review of cases I might be missing.

**Got:** an explanation of the Checkout and webhook flow. The main points were to verify payment on the server before granting PRO, refresh the account status after Checkout, and keep trial dates and ADMIN access intact. The review also brought up duplicate Checkout requests, cancellation, renewal and failed payments.

**Did with it:** I configured the Stripe sandbox and wrote down the monthly and yearly requirements. When I tested a payment locally, the displayed tier didn't update, so I asked for a fix, automatic status refresh and clearer startup instructions. I used AI to help run checks and sandbox scenarios for purchase, cancellation and renewal. At the milestone review, 94 unit tests passed, along with formatting, lint and TypeScript checks. This is test-mode billing only, and connecting it to the quiz/session and coach screens is separate integration work.