# Engineering practices: proposals for discussion

Proposed for the next team meeting, not agreed. Each one is chosen for how FitnessCoach is built: Next.js, Prisma, and an LLM coach behind a verifier. Whatever the team agrees goes into the README's "How we work".

1. **Small commits every week.** A few small commits a week per person rather than one large push before a checkpoint. The course reads contribution from the Git history, and problems with environment variables or Prisma migrations on the hosted database show up the week they are introduced.

2. **Core path first.** Sign-in, quiz, plan and a logged workout working end to end by the 14 November checkpoint, before photos, Stripe or Redux. Those stay planned in [PLAN.md](PLAN.md) but are not built in parallel with the core.

3. **One schema per boundary.** A Zod schema for every Server Action input, route handler body and the coach's plan JSON; Prisma types for what is stored. The coach is asked for structured output against the same plan schema, so a malformed reply is rejected before it reaches the verifier, the UI or the database.

4. **Tests that run offline and give the same result every time.** Coach logic stays in plain functions, as `generatePlan` and `verify` already are. Tests use saved model replies instead of calling Groq or Gemini, so CI needs no key and costs nothing. Bad replies are tested on purpose: invalid JSON, an unknown exercise ID, an empty plan, a timeout.

5. **Every model call is bounded.** A time limit and one retry, then the rule-based default plan. User text sent to the coach is length-capped and marked in the prompt as data, not instructions; off-topic or unsafe requests get a fixed reply, and the verifier checks the result either way.

6. **A logger from the start, with no personal data in it.** One module in `src/lib` that logs each coach step (prompt version, model, tokens, time, verifier result) under a request ID. Names, photos and health details never go into logs, prompts or Git; secrets stay in `.env`.

7. **Decisions logged the day they are made.** A row in the decisions table in [ARCHITECTURE.md](ARCHITECTURE.md) with the reason, so the proposal and final report quote it rather than reconstruct it.
