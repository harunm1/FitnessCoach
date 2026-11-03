## 2. Objectives, Architecture, and Key Features

### 2.1 Objectives

FitnessCoach builds a weekly plan for the gym, running or both that fits a person's equipment, schedule, injuries and daily life, lets them log each session on their phone, and answers questions about a movement in the context of their own plan.

The quality objective is trust: a plan reaches the user only after code has checked it against their profile, and the app keeps working when a model provider does not.

### 2.2 Architecture

![Component diagram: phone or laptop, the Next.js app with its server and coach layers, the photo bucket and PostgreSQL, and the outside services](../img/architecture.png)

*Figure 1. Components and their connections. Solid lines carry requests and data; dashed lines are the fallback provider, seeding and CI.*

We use Option A, Next.js full-stack with the App Router, because nothing outside the app calls the backend. Server Components read data on the server, Server Actions handle every form, and one route handler serves the coach chat.

**Data flow.** The quiz saves a `Profile` through a Zod-validated Server Action. The plan builder prompts the model with the profile and every exercise the user can do; the verifier checks the reply before it is saved. The session screen reads today's `PlanDay` and writes a `SetLog` or `RunLog` per entry without a page reload. The body map opens the chat at an exercise and body region.

**UI and UX.** Mobile-first for the gym floor: large touch targets, a rest timer visible without scrolling, and a loading and error state on every route.

### 2.3 Database and cloud storage

- `User` carries the access tier; its `Profile` holds goal, training mode, days, equipment, injuries, occupation and activity level (the last two set volume and rest days).
- `Exercise` is the library, seeded from free-exercise-db (public domain) with our form cues.
- `Plan` has many `PlanDay` (strength, run or rest). Strength days hold `PlanExercise` slots that reference an `Exercise` by id, so a plan can contain only exercises we hold; run days hold a `PlanRun` (session type, distance, target pace).
- `Workout` records a session, with `SetLog` rows for lifts and a `RunLog` for a run.
- `Conversation` has many `Message` rows, scoped to the user; a body-map message keeps its exercise and region for the next plan.
- `ProgressPhoto` holds a storage key and a date.

Better Auth adds its session and account tables. Progress photos meet the cloud storage requirement: the bucket is private, the server issues upload and view URLs that expire after a few minutes, and the database keeps only the key, tied to the user.

### 2.4 Key design decisions

| Decision | Reason | Trade-off |
| --- | --- | --- |
| Better Auth, not Auth0 | Self-hosted with a Prisma adapter, so users and sessions sit in our PostgreSQL beside the tier; Auth0 bills by monthly active users above its free tier | We run authentication ourselves |
| The model picks exercise ids from our library | It cannot invent an exercise, and the verifier checks every choice | The library fills the prompt: one plan a minute per account on Groq's free tier |
| Running plans by rule, not by the model | Distance and pace progressions are arithmetic; the verifier caps weekly distance growth at about 10% | Less variety than a model-written plan |
| Groq first, Gemini as fallback | In our test each free tier failed within ten requests; the chain served ten verified plans of ten | Two keys to manage |

### 2.5 Failure handling

A failure degrades one capability, not the app: without the model providers, users still get a rule-based plan and log workouts; without the bucket, only photos stop.

| Risk | How we handle it |
| --- | --- |
| Provider limit or outage | 30-second timeout, a retry after the provider's stated wait, then the other provider, then the rule-based plan; chat shows a cached reply |
| Malformed or wrong plan | Zod schema, then the verifier (ids exist, equipment owned, injuries avoided, ranges, no duplicates, day count); one regeneration with the problems listed |
| Unsafe advice | Reported pain stops the exercise and suggests a professional; the rule is in code, not the prompt |
| Races and double submits | Two regenerations of one plan serialised with an `updatedAt` check; a unique key stops a duplicate set log |
| Bad input and errors | Zod field errors on every Server Action; users see one plain message, never a stack trace |
| Unauthorized access | Session and tier checked on the server for every action; every query filtered by user id; keys only in environment variables |

### 2.6 How the required technologies are used

| Requirement | Our use |
| --- | --- |
| TypeScript, Next.js | App Router: Server Components, Server Actions, one route handler |
| Tailwind CSS, shadcn/ui, responsive design | Mobile-first screens from shadcn/ui components |
| PostgreSQL | Prisma schema, committed migrations, seeded library |
| Cloud storage | Private bucket for progress photos; the key in `ProgressPhoto` |

### 2.7 Advanced features

We commit to two:

1. **Authentication and authorization.** Better Auth sign-in, and four tiers checked on the server: free (plans and logging), trial, pro (adds the coach chat) and admin (edits the library).
2. **Integration with an external AI API.** The coach writes strength plans and answers chat through Groq with Gemini as fallback, behind the verifier and the failure handling above.

One planned extension, reported as finished only if it is: **real-time** coach replies streamed token by token.

### 2.8 Scope and feasibility

Voice, camera form checks and payments are out of scope. The schema, seeded library, CI (format, lint, types, tests, build on every pull request) and verifier are on `main`; the provider layer is in review with 32 tests. Each area (accounts; quiz and session; progress and photos; coach) builds against the shared schema and merges weekly, and we use the app ourselves as each piece lands. Demo features freeze on 23 November; the demo path is sign-in, quiz, plan, a logged workout and one coach exchange.
