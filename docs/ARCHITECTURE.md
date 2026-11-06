# Architecture (draft)

## How it is used

A mobile-first website, used on the phone at the gym and on a laptop at home.

| When   | What the user does                                                                                                |
| ------ | ----------------------------------------------------------------------------------------------------------------- |
| Before | Takes the quiz (goal, days a week, equipment, injuries), gets a plan built from our exercise library              |
| During | Opens today's session: logs sets with large buttons, rest timer, asks the coach ("bench is taken, what instead?") |
| After  | Sees streaks, a calendar heatmap and progress photos                                                              |

The coach is a chat panel on every page, not only the body map. Tapping a muscle on the body map opens the chat with that exercise and spot already filled in.

```mermaid
flowchart LR
  U[Phone or laptop] --> N[Next.js app]
  N -->|Server Actions| DB[(PostgreSQL via Prisma)]
  N -->|signed URLs| S[(Cloudflare R2: private photos)]
  N -->|route handler, streamed| C[Coach]
  C --> L[LLM API]
  C --> V[Verifier in code]
  V --> DB
```

## The coach

**Grounded, not free-form.** Every request sends the model this user's profile, plan, last workouts, the current conversation and the matching exercise library entries. The model is stateless; the conversation lives in our database, scoped to the user, so one user's data never reaches another user's request.

**Plans are picked, not invented.** The model chooses exercises by ID from our library and fills sets, reps and rest. It cannot name an exercise we do not have.

**A verifier checks everything before it is saved or shown.** Plain TypeScript, unit-tested, no second model:

- the reply matches the JSON schema
- every exercise ID exists and fits the user's equipment and reported injuries
- sets, reps and rest are in range; no exercise twice on one day
- a swap suggestion targets the same muscle as the original

A plan that fails is regenerated once with the problems listed, then the user gets a rule-based default plan. A rate limit or outage at the provider is retried with backoff, then the request moves to the other provider (D6); only after both fail does the user see the default plan.

**The coach sees the whole library.** Every exercise the user can do (their equipment, nothing that works a reported injury) goes into the prompt by name, grouped by muscle; nothing is cut for length (D7). The model answers with names, code maps them to ids, and the verifier checks the ids.

**Safety rules are code, not prompt.** If the user reports pain (not effort), the coach stops the exercise and suggests a professional. It does not diagnose. The rules are in `src/lib/coach/guardrails.ts` (#43): every user message is checked before a model call and every reply before it is shown; a reply that diagnoses or names a dose is replaced; off-topic requests get a one-line redirect; user text only ever goes in as the user message.

**Form feedback questions are bounded:** where it is felt, at which point in the rep, the weight against usual. The answers pick a fix from the exercise's library entry (cues, common mistakes), so the advice traces to text we wrote.

**One chat turn, in a fixed order** (`src/lib/coach/chat.ts`, #11): the guardrail check on the message, then the model with a system prompt built from this user's plan and profile, then the check on the reply. If no provider answers, the user gets a short fixed reply and logging keeps working. Plans and chat use the same provider order (`coachModel`, `coachChatModel`).

**Text, not voice.** Voice adds speech-to-text, text-to-speech, microphone permissions and latency, and is not one of the course's advanced features. Streamed text replies are.

## Decisions

|     | Choice                                                                                                                                            | Why                                                                                                                                                                                                                                                                                                                                                                     | Cost                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| D1  | Next.js App Router (option A) ([research](RESEARCH.md#2-architecture))                                                                            | Nothing outside the app calls the backend, so no public REST API is needed. Server Components load data on the server; Server Actions are typed form handlers with CSRF protection; route handlers cover the Stripe webhook and streamed coach replies                                                                                                                  | Tied to Next.js; a mobile app later needs an API                                                   |
| D2  | PostgreSQL with Prisma                                                                                                                            | Relational data: user to plan to exercises to logged sets; typed queries and committed migrations                                                                                                                                                                                                                                                                       | Complex reports may need raw SQL                                                                   |
| D3  | Private Cloudflare R2 bucket (S3-compatible), key in the database                                                                                 | Photos are personal; short-lived signed URLs for upload and view. R2 free tier: 10 GB-month of Standard storage, 1M Class A and 10M Class B operations a month, no egress fees ([Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/), checked 6 Nov 2026); DigitalOcean Spaces has no free tier. Changed 6 Nov from Spaces, as Farnaz proposed in #16 | A server round trip per photo                                                                      |
| D4  | Groq first, Gemini as fallback ([research](RESEARCH.md#2-architecture))                                                                           | More free requests a day than Gemini, no card, and Gemini's free tier may use prompts to improve Google's products                                                                                                                                                                                                                                                      | Two providers behind one function; prompts tested on both                                          |
| D6  | Retry, then the other provider, then the rule-based plan (30 Oct, [eval](COACH_EVAL.md))                                                          | Free tiers fail inside ten requests: Groq's 8,000 tokens a minute, Gemini's 20 requests a day on Flash; in the eval the chain served 10 of 10 plans where either provider alone did not                                                                                                                                                                                 | Two keys to manage; the fallback model (Gemini 3.5 Flash-Lite) needs a retry more often            |
| D7  | The whole eligible exercise list in every plan prompt, as names grouped by muscle (30 Oct, [eval](COACH_EVAL.md))                                 | The team wants every exercise available to the coach; grouped names cost 4,700 tokens for the full gym against 7,900 for one line per id                                                                                                                                                                                                                                | One plan a minute per account on Groq's free tier; near-miss names need forgiving matching in code |
| D5  | Deploy to a hosted platform for the demo                                                                                                          | A live URL is shown in the presentation and README; it tests env vars, secrets and storage the way users meet them                                                                                                                                                                                                                                                      | Hosted database and setup time; free-tier limits. Running locally is the fallback                  |
| D10 | Stream coach replies a sentence at a time, checked before each sentence goes out (3 Nov, #11)                                                     | Token streaming would show a diagnosis before the reply check could catch it; a sentence at a time still feels live, and the check runs on everything so far before any new text is shown. The other provider is tried only before the first sentence                                                                                                                   | Slightly later first text than token streaming; a reply cut by the check ends with the fixed line  |
| D11 | Onboarding shows the rule-based plan instantly; the coach personalizes on demand (3 Nov [design review](design-reviews/2026-11-03-coach.md), #58) | No 2 to 15 second wait at sign-up and no quota spent on every new user; the model runs when the user asks, behind the same verifier                                                                                                                                                                                                                                     | The first plan is generic until the user asks the coach                                            |
| D12 | Demo-critical coach outputs are cached and the fallback is immediate in demo mode (3 Nov design review, #59)                                      | Several people on the Groq and Gemini free tiers at once would exhaust both; a provider drop must not show a 30-second wait                                                                                                                                                                                                                                             | Cached outputs must be refreshed when the prompt changes                                           |
| D13 | A pain question gets safe programming guidance; a pain report stops the exercise (3 Nov design review, #48)                                       | A hard stop on every mention of pain frustrates a user asking how to train safely; neither path diagnoses                                                                                                                                                                                                                                                               | One more rule to test; the line between a question and a report is decided in code                 |
| D14 | Merge order: schema, then logic, then screens; the author merges after 72 hours without a review (3 Nov design review)                            | Ten stacked pull requests made coordination the bottleneck                                                                                                                                                                                                                                                                                                              | Some code merges having been read only by its author                                               |

## Advanced features

Promised: authentication with four access tiers checked on the server; external APIs (the coach).
Planned ([shortcuts](RESEARCH.md#3-plan-shortcuts-for-the-advanced-features)): real-time (streamed replies, notifications), photo processing (resize, strip location, then-vs-now image), Redux Toolkit for the quiz, body map and workout session, Stripe test mode.

## Open

Listed in [RESEARCH.md](RESEARCH.md#for-the-next-meeting) for the next meeting.
