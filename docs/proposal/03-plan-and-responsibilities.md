## 3. Plan and Responsibilities

During team formation, we shared backgrounds and preferences and divided work around our strengths.

### 3.1 Stages

The course health check on 18 November and final report on 6 December anchor our schedule. We build in four stages: foundation (schema, authentication, CI), the core path, integration and demo features, then testing and the report. Our core path—sign-in, quiz, plan, logged workout and one coach exchange—is due 15 November. Demo features freeze on 23 November; 24–26 November goes to slides, rehearsals and live-demo testing. Development and polishing continue until the report.

### 3.2 Responsibilities

Nabeegh owns the architecture, research and coach evaluation, foundation (schema, seed, CI) and the AI coach, including running plans. Shubham owns accounts, access tiers, session authentication, coach request limits, event storage and optional Stripe billing. Mohammad owns quiz, body map and session screens. Farnaz owns workout history, streaks, the heatmap, progress photos and cloud storage. Running is built alongside lifting.

### 3.3 Integration and Dependencies

Every Tuesday at 7 p.m., each member reports what they built, blockers and next steps. Questions, decisions and blockers stay on related GitHub issues; Discord handles scheduling. Team brainstorming, informed by our [research](https://github.com/harunm1/FitnessCoach/blob/main/docs/RESEARCH.md) and [coach evaluations](https://github.com/harunm1/FitnessCoach/blob/main/docs/COACH_EVAL.md), settles design.

The shared Prisma schema, workout-plan JSON and authentication are the critical path: signed-in quiz, session and progress integration depends on them. Each task has an issue, branch and PR with `Closes #n`, covering one feature or fix for review in one sitting. Code PRs need one teammate approval; documentation merges without review when conflict-free. No teammate receives more than three small, separate PRs daily. Branches merge weekly so the app runs together. CI runs formatting, lint, TypeScript checks, tests and build.

### 3.4 Risks and Scope

We use the app ourselves as each piece lands. LLM failures trigger Groq retries, then Gemini; if both fail, a rule-based plan and a fixed coach message keep the demo live. A recording is the last resort. We discuss schema changes and retain a stable demo if integration or feature work slips.
