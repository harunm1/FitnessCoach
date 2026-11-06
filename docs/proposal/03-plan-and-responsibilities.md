## 3. Plan and Responsibilities

During team formation, we shared backgrounds and preferences and divided work around our strengths.

### 3.1 Stages

The course health check on 18 November and final report on 6 December anchor our schedule. Our core path—sign-in, quiz, plan, logged workout and one coach exchange—is due 15 November. Demo features freeze on 23 November; 24–26 November goes to slides, rehearsals and live-demo testing. Development and polishing continue until the report.

### 3.2 Responsibilities

Nabeegh owns foundation (schema, seed, CI) and the AI coach, including running plans. Shubham owns authentication and access tiers. Mohammad owns quiz, body map and session screens. Farnaz owns workout history, progress photos and cloud storage. Running is built alongside lifting.

### 3.3 Integration and Dependencies

Every Tuesday at 7 p.m., each member reports what they built, blockers and next steps. Questions, decisions and blockers stay on related GitHub issues; Discord handles scheduling. Team brainstorming, informed by our [research](../RESEARCH.md) and [coach evaluations](https://github.com/harunm1/FitnessCoach/blob/nabeegh/19-coach-eval/docs/COACH_EVAL.md), settles design.

Shared Prisma schema and workout-plan JSON are agreed first. Quiz, sessions and progress depend on schema and authentication. Each task has an issue, branch and PR with `Closes #n`, covering one feature or fix for review in one sitting. Code and proposal PRs need one teammate approval; proposal/documentation PRs request all teammates. No teammate receives more than three small, separate PRs daily. Branches merge weekly so the app runs together. Meeting/admin notes may go directly to unprotected `main`. CI runs formatting, lint, TypeScript checks, tests and build.

### 3.4 Risks and Scope

We use the app ourselves as each piece lands. LLM failures trigger Groq retries, then Gemini; if both fail, a rule-based plan and cached coach reply keep the demo live. A recording is the last resort. We discuss schema changes and retain a stable demo if integration or feature work slips.
