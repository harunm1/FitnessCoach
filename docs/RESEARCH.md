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

**D4, LLM provider.** Groq's free tier needs no card and allows about 1,000 requests a day on its larger models ([eesel](https://eesel.ai/blog/groq-pricing)). Gemini's free tier is Flash-only with reported limits near 20 requests a day, and free-tier prompts can be used to improve Google's products ([agentdeals](https://agentdeals.dev/gemini-api-pricing-changes)). Groq first, Gemini as fallback, no names or photos sent.

**Auth.** Better Auth has a Prisma adapter and a Next.js handler; Prisma's own guide only guards pages in the browser, so we check the session and tier on the server ([Prisma](https://prisma.io/docs/guides/betterauth-nextjs)).

**Auth, the alternatives (checked 30 October).** Auth0 is a managed service: the user store sits on Auth0's side and the free tier ends at 7,500 monthly active users, after which it bills per user ([pkgpulse](https://www.pkgpulse.com/guides/lucia-auth-v3-vs-better-auth-vs-stack-auth-self-hosted-2026)); Auth.js (NextAuth) is the older self-hosted library and defaults to JWT sessions, which cannot be revoked before expiry without a server-side blocklist ([nexty.dev](https://nexty.dev/blogs/nextjs-boilerplate-better-auth-drizzle)); Better Auth is self-hosted, TypeScript-native, keeps users and sessions in our PostgreSQL through a Prisma adapter, and ships rate limiting and CSRF protection ([Better Stack](https://betterstack.com/community/guides/scaling-nodejs/better-auth-vs-nextauth-authjs-vs-autho/), [OpenReplay](https://blog.openreplay.com/betterauth-explained-rapid-developer-adoption/)). Our tiers come from Stripe and must sit next to the user row, so the user store has to be ours; that, and database sessions we can end on the server, is why Better Auth over Auth0, not only that the course recommends it.

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

## For the next meeting

- Groq first, or Gemini?
- Scope: gym only, or gym and running? Running plans are distance and pace progressions built by rules, so they reuse the plan, logging and verifier with little new code. Pilates has no open dataset and would need its library written by hand.
- Who imports free-exercise-db and adds form cues for the exercises the coach uses most?
