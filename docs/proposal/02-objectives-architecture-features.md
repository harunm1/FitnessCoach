## 2. Objectives, Architecture, and Key Features

### 2.1 Objectives

A short quiz produces a weekly gym, running or hybrid plan that fits the user's goal, equipment, schedule, injuries and daily life; the user logs sessions on their phone, and plan and progress update as they train. A coach chat answers questions about the user's own plan.

The technical objective is a trustworthy coach: code checks every plan before it is saved, and failures never lose data or leave an empty screen.

### 2.2 Architecture and data flow

![Component diagram of the frontend, backend, AI coach, data stores and services](https://raw.githubusercontent.com/harunm1/FitnessCoach/main/docs/img/architecture.png)

_Figure 1. Dashed lines: fallback provider, seeding and CI._

We use Option A, Next.js full-stack with the App Router: no outside client calls our backend. The React frontend (Tailwind CSS, shadcn/ui) reaches the backend three ways: Server Components load data before the page renders, Server Actions validated by Zod handle every form, and one route handler serves coach chat.

In the AI coach the model proposes and code decides: only a plan that passes the verifier is saved.

**UI and UX.** Mobile-first for mid-workout use: large touch targets, a visible rest timer, and loading and error states on every route.

### 2.3 Database and cloud storage

| Entity                        | Relationships                                                                 | Feature                                                            |
| ----------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `User`, `Profile`             | one to one; goal, mode, days, equipment, injuries, occupation, activity       | Sign-in, tiers, quiz                                               |
| `Exercise`                    | used by plan slots and set logs                                               | 876 exercises from free-exercise-db (Yuhonas, n.d.), with our cues |
| `Plan`, `PlanDay`             | user has many plans; plan has many days (strength, run or rest)               | The weekly plan                                                    |
| `PlanExercise`, `PlanRun`     | slots reference an `Exercise`; runs have type, distance, pace                 | Only exercises we hold                                             |
| `Workout`, `SetLog`, `RunLog` | user has many workouts; each has set logs or a run log                        | Logging, history, streaks                                          |
| `Conversation`, `Message`     | user has many, each with messages; body-map messages keep exercise and region | Chat that remembers feedback                                       |
| `ProgressPhoto`               | user has many; stores a key, not the file                                     | Progress photos                                                    |

Server Components read through Prisma, Server Actions write, and every query is filtered by the signed-in user's id. Photos meet the cloud storage requirement: a private bucket, upload and view URLs from the server that expire within minutes, and only the key in `ProgressPhoto`.

### 2.4 Key design decisions

| Decision                               | Why it fits FitnessCoach                                                                                                                                   | Trade-off                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| The model picks only from our library  | No invented exercises, none the user cannot do                                                                                                             | A long prompt: about one plan a minute on Groq's free tier (Groq, 2026) |
| Running by rule, strength by the model | Running progression is arithmetic; strength choice benefits from a model                                                                                   | Less varied running plans                                               |
| Better Auth, not Auth0                 | Users and sessions stay in our database beside the tier (Better Auth, 2026)                                                                                | We run authentication ourselves                                         |
| Groq first, Gemini as fallback         | In our [test](https://github.com/harunm1/FitnessCoach/blob/main/docs/COACH_EVAL.md) each free tier failed within ten requests; the chain served ten of ten | Two keys to manage                                                      |

### 2.5 Failure handling, error states and testing

A failure degrades one capability, never the whole app: without a model, users still get a rule-based plan.

| Failure                          | How the app responds                                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Dropped connection while logging | The entry stays on screen, marked unsaved, with a retry; a retry never stores a set or run twice                             |
| Dropped connection during chat   | The server saves the finished reply; reopening the chat loads it                                                             |
| Bad input                        | Zod on the form and in the Server Action; plain errors, no stack trace                                                       |
| Model slow, rate-limited or down | 30-second timeout, a short retry, the other provider, then the rule-based plan; chat shows a cached reply                    |
| Malformed or unsafe plan         | Schema check, then the verifier (ids, equipment, injuries, ranges, duplicates, day count); one regeneration listing problems |
| Out-of-scope or unsafe chat      | Rules in code: reported pain stops the exercise and suggests a professional; no diagnosis                                    |

Every model call will be logged with provider, prompt version, latency and outcome. Vitest unit tests mock the network; CI runs format, lint, types, tests and build on every pull request, and will replay ten fixed coach profiles. From mid-November we pilot the demo path on a deployed preview and log what breaks as issues labelled `pilot`.

### 2.6 How the required technologies are used

TypeScript throughout; Next.js, Tailwind CSS and shadcn/ui as in 2.2; PostgreSQL through Prisma migrations and the seeded library; cloud storage as the private photo bucket in 2.3.

### 2.7 Advanced features

We commit to two:

1. **Authentication and authorization.** Better Auth sign-in; four tiers checked on the server in every Server Action and route handler: free (quiz, rule-based plan, logging), trial (coach chat until it ends), pro (coach chat; set by an admin, or by Stripe test mode if built), admin (edits the library).
2. **Integration with an external AI API.** Groq, with Gemini as fallback, writes strength plans and answers chat behind the verifier; plans land in the session screen's tables.

One planned extension, reported only if finished: **real-time** coach replies streamed a sentence at a time, each checked before it is shown.

### 2.8 Scope and feasibility

On `main`: the Next.js skeleton, strength schema and first migration, seeded library, CI, plan generation with the verifier, and provider fallback. Each owner's area builds against the shared schema and merges weekly. Voice and camera form checks are out of scope; Stripe test-mode upgrades to pro are a stretch off the demo path.
