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

## Photo storage

Progress photos go in a private Cloudflare R2 bucket, as Farnaz proposed in #16, S3-compatible, with only the object key in the database (D3 in `ARCHITECTURE.md`). The R2 free tier covers 10 GB-month of Standard storage, 1 million Class A and 10 million Class B operations a month, and no egress fees ([Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/), checked 6 Nov 2026). DigitalOcean Spaces, the first choice, has no free tier: $5 a month from the start ([Spaces pricing](https://docs.digitalocean.com/products/spaces/details/pricing/), checked 6 Nov 2026). Enabling R2 goes through a checkout step ([R2 get started](https://developers.cloudflare.com/r2/get-started/), checked 6 Nov 2026); Farnaz reports it may ask for a payment method (#16). Photos build against a local folder first, so the feature does not wait on the account.

## UI components

shadcn/ui, set up 8 November 2026 (#75, D17 in `ARCHITECTURE.md`). CLI version 4.23.0, the latest on npm that day (`npm view shadcn version`, checked 8 Nov 2026). `shadcn init --help` lists three component bases (`base`, `radix`, `aria`), and its `--defaults` flag means `--template=next --preset=base-nova`; we ran `shadcn init -b base -p nova`, the Base UI library with the Nova preset, the same choices as Assignment 4. Lecture 7 (setup slides) and Lecture 8 (`buttonVariants()` on a link) show the same `npx shadcn@latest init` flow. The [Next.js installation page](https://ui.shadcn.com/docs/installation/next) and the [`components.json` page](https://ui.shadcn.com/docs/components-json) (both checked 8 Nov 2026) say `tailwind.config` stays blank under Tailwind v4 and that `style` and `baseColor` cannot be changed after init.

What init installed: `@base-ui/react`, `class-variance-authority`, `lucide-react`, `tw-animate-css`, `shadcn` (its `tailwind.css` is imported by `globals.css`) and `cn`, shadcn's own class-name merger that replaces `clsx` plus `tailwind-merge` (npm maintainer shadcn, repository `shadcn-ui/cn`, checked 8 Nov 2026). Components added: Button, Input, Label, Card. The base-nova registry's `form` item has no files (`shadcn view form`, checked 8 Nov 2026); its components list has Field instead, to be added with the first form that uses it.

Two changes to what init wrote. It set `--font-sans: var(--font-sans)`, which refers to itself, so it points at the Geist font from `layout.tsx` again. It added `outline-ring/50` to every element, which would recolour the browser's focus outline on the existing screens, so that line is left out; the shadcn components draw their own focus ring. Background, foreground and primary keep the app's existing colours.

## Questions from the early meetings

Settled: provider (#7), scope (#12), exercise library owner (#8, cues open).
