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

### ExerciseBank and four competitors: media, joint data and running (checked 11 Nov 2026; for #8, #92, #94)

**What ExerciseBank holds.** 1,492 exercises filmed in one studio, each with muscles, equipment, movement pattern, difficulty 1 to 5, the joints it loads (nine values: ankle, cervical spine, elbow, hip, knee, lumbar spine, shoulder, thoracic spine, wrist), impact (low, moderate, high), ranked substitutes with a stated reason, and English and French cues ([API docs](https://exercisebank.net/docs)). Plans are priced by monthly end users, not by call: Sandbox is free (25 end users, 5,000 requests a month, video for 50 exercises); Starter is US$29 a month (500 users, all video); Pro $79; Business $199. Solo, US$39 a year, is for one person and "not for an app's users" ([pricing](https://exercisebank.net/pricing), [Solo](https://exercisebank.net/solo)).

**Licence** ([plain-words licence](https://exercisebank.net/license), updated 10 Sep 2026). Allowed: show exercises, clips, descriptions and cues to the product's own users inside the product; store the catalogue metadata and reword or extend it. Not allowed: re-hosting or redistributing video or stills, sharing the key with another product, training machine-learning models on the library without a written agreement, and running "a product available to the public on the sandbox plan". When a plan ends, stored media must be deleted and stored metadata may be kept but not used in a product. Video comes only as signed links that expire (15 minutes by default) and must not be stored; the key must stay on the server ([docs](https://exercisebank.net/docs)). So the free tier is for building and demoing; a public deployment needs Starter. The pricing page invites students to describe their project on its help page; nobody has asked yet whether a course demo qualifies.

**Fit with our 30 cue exercises (PR #102).** Searching nine of the staples by name found a close match for bench press, Romanian deadlift, dumbbell lunge, shoulder press, push-up, pull-up and glute bridge or hip thrust; a plain back squat appears only as variants. Of the 36 results read, two sit in the 50-exercise free-video sample (single-leg Romanian deadlift, dumbbell row to curl) and none is a staple, so the free tier would not show video for the exercises the starter plan uses most. Some records look noisy: "Pull-up" is tagged with barbell equipment and a horizontal pull, and two entries are both named "Rowing" with identical tags (a sample of nine searches, not an audit).

**Running.** A search for "run" returns 73 hits, but they are mostly drills and substring matches. Of the first 50, 26 concern running or sprinting (jog, incline treadmill jog, bounding, high-knees drill, carioca, hurdle run-throughs, sprinter arms) and the other 24 are crunch variants that contain the letters "run"; the last 23 were not read. These are conditioning drills, not training plans, and video for them is Solo or paid except three (alternating fast feet, single-leg swing hop, split-stance sprinter arms). In our app runs are `PlanRun` rows built by rule (D8), and #8 leaves running form out, so there is nothing for this data to fill.

**How the competitors source exercise content.** None of the four pages below says who produced the media.

| App    | What its own pages say                                                                                                                                                                                               | Source                                                                                                                              |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Hevy   | Built-in library of 400+ exercises, each with an animation and step-by-step instructions; users add custom exercises with their own photo, video or GIF (7 on the free plan, unlimited on Pro)                       | [Hevy help](https://help.hevyapp.com/hc/en-us/articles/35688251991575-Hevy-Exercise-Library-400-Exercises-and-Custom-Exercises)     |
| Fitbod | Own exercise guide pages with a photo, a short description and a popularity rank from sets logged by its users; the App Store listing claims 1,000+ exercises and hi-res video                                       | [Fitbod exercises](https://fitbod.me/exercises), [App Store](https://apps.apple.com/tm/app/fitbod-workout-gym-planner/id1041517543) |
| Runna  | Strength sessions are "pre-built Runna workouts"; tapping an exercise image shows an animation and form tips; users cannot create or swap exercises yet, and strength sessions sit outside the adaptive running plan | [Runna support](https://support.runna.com/en/articles/15624879-adding-strength-training-to-your-runna-plan)                         |
| Strong | App Store listing: "detailed exercise instructions with a growing library of animated videos"; nothing on the source                                                                                                 | [App Store](https://apps.apple.com/bf/app/strong-workout-tracker-gym-log/id464254577)                                               |

All four keep a closed, curated library and none offers it for reuse. The routes open to a small team are open data (free-exercise-db, Unlicense, already seeded) or a paid licence (ExerciseBank above; ExRx also sells its exercise database and video as an app licence, [ExRx licensing](https://exrx.net/Store/Other/Licensing)). The cue sources for #102 are ExRx pages; the cues must be in the team's own words, which this note did not check.

**Decision (free only).**

1. Do not put ExerciseBank data or video in the app. Free covers building, not a public deployment, and the public tier is US$29 a month. The library stays free-exercise-db plus the team's own cues.
2. Take the idea, not the data. #94 and #92 need to know which joints an exercise loads. Add `loadedJoints` (the same nine anatomical joint names) and `impact` for the 30 cue exercises, filled in by the team from anatomy references and checked by a second person. Do not copy ExerciseBank's per-exercise values: stored metadata may not be used in a product once a plan ends. This is a schema change (foundation) plus 30 rows of data (library), a separate issue after the 15 November core path, not part of #102.
3. Running: no ExerciseBank use. Run days stay `PlanRun` rows built by rule. If run days need a warm-up, a few lines of text in the run builder are enough.
4. Optional, not done: ask ExerciseBank on its help page whether a course demo qualifies for the free tier; only an account holder can send it.

**Limits.** Vendor pages are vendor claims; the competitor pages were read for what they say, not tested in the apps. The ExerciseBank data was read through a free account's search, not through an API key, and nothing was stored. Coverage of the 30 is a name search on nine exercises, not a full mapping.

## Photo storage

Progress photos go in a private Cloudflare R2 bucket, as Farnaz proposed in #16, S3-compatible, with only the object key in the database (D3 in `ARCHITECTURE.md`). The R2 free tier covers 10 GB-month of Standard storage, 1 million Class A and 10 million Class B operations a month, and no egress fees ([Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/), checked 6 Nov 2026). DigitalOcean Spaces, the first choice, has no free tier: $5 a month from the start ([Spaces pricing](https://docs.digitalocean.com/products/spaces/details/pricing/), checked 6 Nov 2026). Enabling R2 goes through a checkout step ([R2 get started](https://developers.cloudflare.com/r2/get-started/), checked 6 Nov 2026); Farnaz reports it may ask for a payment method (#16). Photos build against a local folder first, so the feature does not wait on the account.

## Questions from the early meetings

Settled: provider (#7), scope (#12), exercise library owner (#8, cues open).
