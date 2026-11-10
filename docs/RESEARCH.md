# Research

What we checked on 20 October, grouped by the proposal section it feeds.

## 1. Motivation

**Similar apps**

| App          | What it does                                    | Price (US)      |
| ------------ | ----------------------------------------------- | --------------- |
| SensAI       | AI chat coach with memory; builds programs      | $6.99/mo        |
| Fitbod       | Generates each strength session                 | $15.99/mo       |
| JuggernautAI | Adjusts powerlifting programs from set feedback | $34.99/mo       |
| Future       | Human coach by message                          | $149 to $199/mo |

None is documented as asking follow-up questions about where a movement is felt. That is the gap the body map fills. A $10/month tier sits in the AI-app range, well under a human coach. ([SensAI review](https://www.sensai.fit/blog/best-ai-personal-trainer-apps-2026))

**Why people quit:** to read before citing. Sperandei, Vieira and Reis (2016), attrition among fitness centre members, https://doi.org/10.1016/j.jsams.2015.12.522; Gabay and Oravițan (2022), a review of adherence in fitness facilities, https://doi.org/10.2478/tperj-2022-0013.

## 2. Architecture

**D1, Next.js.** Server Actions suit forms only our app calls; route handlers suit anything outside callers need, such as webhooks and streaming. A separate API is worth it when other clients call it ([dev.to](https://dev.to/myogeshchavan97/nextjs-server-actions-vs-api-routes-dont-build-your-app-until-you-read-this-4kb9)).

**D4, LLM provider.** Groq's free tier needs no card and allows about 1,000 requests a day on its larger models ([eesel](https://eesel.ai/blog/groq-pricing)). Gemini's free tier is Flash-only with reported limits near 20 requests a day, and free-tier prompts can be used to improve Google's products ([agentdeals](https://agentdeals.dev/gemini-api-pricing-changes)). Groq first, Gemini as fallback, no names or photos sent. Checked 30 October against our own keys: Groq's chat models are now OpenAI's open-weight gpt-oss-120b and gpt-oss-20b and Qwen's qwen3.8-27b, and it no longer serves Llama, so the Llama 3.1 70B result cited in #22 does not carry over directly. Gemini's free key lists the 2.5, 3 and 3.5 Flash models. Both providers ran on the same test profiles (#19). Decided 30 October (#7, eval in COACH_EVAL.md).

**Auth.** Better Auth has a Prisma adapter and a Next.js handler; Prisma's own guide only guards pages in the browser, so we check the session and tier on the server ([Prisma](https://prisma.io/docs/guides/betterauth-nextjs)).

**Auth, the alternatives (checked 30 October).** Auth0 is a managed service: the user store sits on Auth0's side and the free tier ends at 7,500 monthly active users, after which it bills per user ([pkgpulse](https://www.pkgpulse.com/guides/lucia-auth-v3-vs-better-auth-vs-stack-auth-self-hosted-2026)); Auth.js (NextAuth) is the older self-hosted library and defaults to JWT sessions, which cannot be revoked before expiry without a server-side blocklist ([nexty.dev](https://nexty.dev/blogs/nextjs-boilerplate-better-auth-drizzle)); Better Auth is self-hosted, TypeScript-native, keeps users and sessions in our PostgreSQL through a Prisma adapter, and ships rate limiting and CSRF protection ([Better Stack](https://betterstack.com/community/guides/scaling-nodejs/better-auth-vs-nextauth-authjs-vs-autho/), [OpenReplay](https://blog.openreplay.com/betterauth-explained-rapid-developer-adoption/)). Our tiers come from Stripe and must sit next to the user row, so the user store has to be ours; that, and database sessions we can end on the server, is why Better Auth over Auth0, not only that the course recommends it.

**D2, indexes (checked 8 November 2026 and again 10 November, Prisma 7.10.1, PostgreSQL 16).** A foreign key does not create an index on the referencing columns in PostgreSQL: "the declaration of a foreign key constraint does not automatically create an index on the referencing columns" ([PostgreSQL 16, Constraints](https://www.postgresql.org/docs/16/ddl-constraints.html)). Prisma Migrate adds none either (observed in `prisma/migrations`: indexes exist only for `@unique`, `@@unique` and `@@index`), so each index is declared with `@@index` in the schema; on PostgreSQL the default access method is B-tree ([Prisma ORM v7, Indexes](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/indexes)). Column order matters: equality constraints on the leading columns, plus an inequality on the first column without one, limit the part of a multicolumn B-tree that is scanned; constraints on later columns are only checked inside the index ([PostgreSQL 16, Multicolumn Indexes](https://www.postgresql.org/docs/16/indexes-multicolumn.html)). In our query plans (#78), Postgres did not treat `finishedAt IS NULL` as an equality for ordering, so a `startedAt` column after it left the same sort on the few matched rows: the `Workout` index stops at `finishedAt`. `Plan`'s `active = true` is an equality, so its index also serves the `createdAt` sort. `prisma migrate dev` generates a migration from the schema change and applies it locally; `prisma migrate deploy` applies committed migrations, and our CI runs it on an empty database (`npm run db:migrate:test`) ([Prisma ORM v7, Development and production](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/development-and-production)). We index only what a query on `main` filters or sorts by (#76).

**D2, constraints (checked 10 November 2026, Prisma 7.10.1, PostgreSQL 16).** Two rules are held by the database, not only by the code: one active plan per user, and one open workout per plan. Both are written as read, check, then write (deactivate the old plan, then insert; look for an open workout, else insert), and under PostgreSQL's default Read Committed the 10 November schema audit broke both: a quiz save racing a coach save left two active plans, because each path serialises on a different row lock, and two taps on Start left two open workouts. A constraint holds for every writer and at any isolation level. It beat one shared lock for both writers, which every future writer would have to remember, and `SERIALIZABLE`, which needs a retry loop around every writer. Prisma 7 declares a partial unique index with `where` on `@@unique`, behind the `partialIndexes` Preview feature ([Prisma ORM v7, Indexes](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/indexes)): `Plan @@unique([userId], where: { active: true })` and `Workout @@unique([planId], where: { finishedAt: null })`. The workout rule is per plan, not per user: a plan switch does not close the old plan's open workout, and a per-user index would stop Start working after a switch. A data migration runs first and keeps only the newest active plan per user and the newest open workout per plan, so the index build cannot fail on old duplicates. When `saveWeek`'s insert hits the active-plan index because a quiz save committed first, it retries once, so the newer save wins, as it already does when two coach saves meet at the User row lock. Range checks are CHECK constraints in a hand-written migration, because CHECK is "Not yet" in the Prisma schema and in Prisma Migrate ([Prisma ORM v7, Database features](https://www.prisma.io/docs/orm/v7/reference/database-features)). They are sanity bounds (counts of at least one, RPE 1 to 10, a day index of 0 to 6, 1 to 7 days a week); the coaching ranges stay in `src/lib/coach/schema.ts`. A plain `ADD CONSTRAINT` validates every row at once, which is instant on our demo data; on large tables, `NOT VALID` and then `VALIDATE` in a separate migration would shorten the lock. `Workout.planId` and `Workout.planDayId` get plain indexes, so deleting a plan or a plan day finds the workouts to set to null without scanning `Workout` (#76).

## 3. Plan: shortcuts for the advanced features

| Feature                  | Tool                                                 | What it saves                                      |
| ------------------------ | ---------------------------------------------------- | -------------------------------------------------- |
| Real-time                | Vercel AI SDK `streamText` and `useChat`             | Streamed coach replies without our own socket code |
| Coach plan and verifier  | AI SDK structured output with a Zod schema           | Plan JSON checked against one schema               |
| Forms                    | One Zod schema per form, browser and Server Action   | Validation written once                            |
| File processing          | `sharp`                                              | Resize and strip metadata, including GPS           |
| Loading and error states | `loading.tsx`, `error.tsx` per route                 | No hand-written spinners or error pages            |
| Demo evidence            | One Playwright test of quiz, plan, logged set, in CI | Proof the demo path works                          |
| Shared data              | `prisma db seed`                                     | Exercise library and a demo user in one command    |

The AI SDK is on v7 and retries a failed call twice by default ([codercops](https://blog.codercops.com/blog/vercel-ai-sdk-2026)); confirm a Groq provider package when installing.

## Exercise data

[free-exercise-db](https://github.com/yuhonas/free-exercise-db): 800+ exercises as JSON with primary and secondary muscles, equipment, level, step-by-step instructions and images, under the Unlicense (public domain). It can seed the exercise library directly and drive the body map from its muscle names.

Hevy's API needs a Hevy Pro subscription and a personal API key tied to one account, so it suits syncing one user's own workouts, not supplying our app's exercise data ([Serval docs](https://docs.serval.com/sections/integrations/hevy)).

## Photo storage

Progress photos go in a private Cloudflare R2 bucket, as Farnaz proposed in #16, S3-compatible, with only the object key in the database (D3 in `ARCHITECTURE.md`). The R2 free tier covers 10 GB-month of Standard storage, 1 million Class A and 10 million Class B operations a month, and no egress fees ([Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/), checked 6 Nov 2026). DigitalOcean Spaces, the first choice, has no free tier: $5 a month from the start ([Spaces pricing](https://docs.digitalocean.com/products/spaces/details/pricing/), checked 6 Nov 2026). Enabling R2 goes through a checkout step ([R2 get started](https://developers.cloudflare.com/r2/get-started/), checked 6 Nov 2026); Farnaz reports it may ask for a payment method (#16). Photos build against a local folder first, so the feature does not wait on the account.

## Questions from the early meetings

Settled: provider (#7), scope (#12), exercise library owner (#8, cues open).
