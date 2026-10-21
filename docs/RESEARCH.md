# Research notes (20 October 2026)

What we checked before building, and what it changed.

## Similar apps

| App | What it does | Price (US) |
|---|---|---|
| SensAI | AI chat coach with memory, builds programs | $6.99/mo |
| Fitbod | Generates each strength session | $15.99/mo |
| JuggernautAI | Adjusts powerlifting programs from set feedback | $34.99/mo |
| Future | Human coach | $149 to $199/mo |

None of these is documented as asking follow-up questions about where a movement is felt. That is the gap the body map targets. Our $10/month tier sits in the AI-app range. ([SensAI review](https://www.sensai.fit/blog/best-ai-personal-trainer-apps-2026))

## LLM provider

- Groq free tier: no card, about 1,000 requests a day on its larger models ([eesel](https://eesel.ai/blog/groq-pricing)).
- Gemini free tier: Flash models only, reported limits near 20 requests a day, and free-tier prompts can be used to improve Google's products ([agentdeals](https://agentdeals.dev/gemini-api-pricing-changes)).
- Decision: Groq first, Gemini as fallback; no names or photos sent to either.

## One model call, not multi-agent

Multi-agent systems use 3 to 10 times the tokens of a single agent and help only when tasks pollute each other's context, run in parallel, or need conflicting tools ([Anthropic](https://www.claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them)). Plan generation is one defined step, so it is one call, checked by a verifier in code.

## Auth

Better Auth ships a Prisma adapter and a Next.js handler. Prisma's guide protects pages only in the browser, so we check the session and tier on the server for every page and action ([Prisma](https://prisma.io/docs/guides/betterauth-nextjs)).

## Shortcuts for the advanced features

- **Vercel AI SDK (`ai`, v7):** `streamText` and `useChat` stream coach replies (real-time); structured output with a Zod schema gives the plan JSON the verifier checks; two retries by default ([codercops](https://blog.codercops.com/blog/vercel-ai-sdk-2026)). Confirm a Groq provider package when installing.
- **One Zod schema per form,** used in the browser and again in the Server Action.
- **`sharp`** resizes photos and strips metadata, including GPS location: the file-processing feature.
- **`loading.tsx` and `error.tsx`** on every route for loading and error states.
- **One Playwright test** of the demo path (quiz, plan, logged set) in CI.
- **`prisma db seed`** loads the exercise library and a demo user.

## Motivation lead (to read before citing)

Sperandei, Vieira and Reis (2016), high attrition among fitness centre members, *Journal of Science and Medicine in Sport*, https://doi.org/10.1016/j.jsams.2015.12.522. A newer review: Gabay and Oravițan (2022), https://doi.org/10.2478/tperj-2022-0013.
