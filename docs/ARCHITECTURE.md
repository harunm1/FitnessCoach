# Architecture (draft for team review)

Draft for proposal section 2. Every decision gives the choice, why, and what it costs. Nothing here is final until the team agrees; comment on Discord or open an Issue.

## What we build

A user takes a short quiz, gets a gym plan, logs workouts and sees progress. A coach explains each exercise and, when the user taps where an exercise feels wrong, asks follow-up questions and suggests fixes from what the user reports (no camera).

## Decisions

**D1. One Next.js app (handout option A), not React plus Express (option B).**
Why: nothing outside the app needs to call our backend, so we do not need a public REST API. Server Components load data on the server, so pages arrive with data instead of fetching after load. Server Actions handle forms (quiz, workout logging) as typed function calls with built-in CSRF protection. Route handlers still cover the two things that must be HTTP endpoints: the Stripe webhook and the coach's streamed replies.
Cost: we are tied to Next.js, a mobile client later would need an API added, and the server/client component boundary is new to us. Option B gives a clean, separately testable REST API but means two codebases, CORS and API documentation.

**D2. PostgreSQL with Prisma.**
Why: the data is relational (a user has a plan, a plan has exercises, each logged set points at a plan exercise), and Prisma gives typed queries and committed migrations.
Cost: complex reporting queries may need raw SQL.

**D3. Private Spaces bucket for photos; the database stores only the file key.**
Why: progress photos are personal. Uploads and views go through short-lived signed URLs.
Cost: every photo view needs a signed URL from the server.

**D4. The coach is one model call per task, not a multi-agent system.**
Why: plan generation is one well-defined step (quiz answers in, plan out), which suits a single call that returns a fixed JSON shape. Multi-agent systems use several times more tokens and add coordination we do not need, and our free-tier quotas are small.
The server validates the JSON against a schema before saving, so a malformed reply never reaches the page. Rules that must always hold (sets and reps in range, no duplicate exercise on a day, streak counts) are plain TypeScript with unit tests, not left to the model.
Cost: one prompt carries a lot; if plans come back poor, we split it into two calls.

**D5. LLM provider: open.**
Groq's free tier (no card, about 1,000 requests a day on its larger models) is more generous than Gemini's (Flash only, low daily limits). Gemini's free tier may use prompts to improve Google's products, so we send no names or photos either way.

**D6. Advanced features: promise two, plan the rest.**
Promised: authentication with four access tiers (visitor, trial, subscriber, expired) checked on the server for every page and action; external APIs (the LLM coach).
Planned: real-time (streamed coach replies, notifications), photo processing (resize, strip location data, then-vs-now image), Redux Toolkit for the quiz, body map and workout session, Stripe test-mode subscriptions.

## Open questions

- Gym only, or also home, yoga and pilates?
- Deploy for the demo or run locally? Deployment is optional.
- Groq or Gemini first?
