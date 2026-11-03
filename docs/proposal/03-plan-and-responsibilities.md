## 3. Plan and Responsibilities

### 3.1 Stages

By 8 November, we will complete the proposal and establish the schema, sign-in and CI foundation. The core journey is due on 14 November, before the 18 November health check and 21 November integration review. Features freeze on 23 November; 24–26 November are reserved for testing, fixes and rehearsals. Presentations are on 27 November or 4 December; final documentation, video and AI-use record are due 6 December.

### 3.2 Responsibilities

Nabeegh owns the foundation, Prisma schema and seed, exercise library, AI coach, verifier, streamed chat and gym and running plans. Shubham owns Better Auth, server-side access tiers, Stripe test mode and local PostgreSQL through Docker Compose at `localhost:5432`. Mohammad owns the quiz, interactive body map, Redux state, session screens and workout and running logs. Farnaz owns workout history, streaks, calendar heatmaps, photos, cloud storage and running progress.

### 3.3 Integration and Dependencies

Shared Prisma models and workout-plan JSON are agreed first; quiz, sessions and progress depend on schema and authentication. Each task has an issue, short branch and PR with `Closes #n`; we integrate frequently. Code and proposal PRs need one approval; proposal and documentation PRs request all teammates as reviewers. Meeting/admin notes may go directly to unprotected `main`. CI runs formatting, lint, TypeScript checks, tests and build.

### 3.4 Risks and Scope

We build running alongside lifting; nearby-gym discovery and MCP exercise tools are stretch. The critical demo is sign-in, quiz, plan, logged workout and coach exchange. Stripe stays outside it: tiers work from trial expiry without payment integration. LLM rate limits or outages trigger Groq retries, then Gemini, then a verified rule-based plan; one recorded demo provides backup. Discuss schema changes, test photo uploads and downloads early, and retain a stable demo if integration or feature work slips.
