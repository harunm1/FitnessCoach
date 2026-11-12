# Stored coach-call records (Issue #52)

## What is stored

`CoachEvent` stores one supplied coach log record for a user. It has a cascading
relation to `User` and an index on `(userId, createdAt)` for user-scoped history
and reporting. This is a server-side library, not a public logging endpoint.

| Fields                                                     | Meaning                                                           |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| `userId`, `createdAt`                                      | Server-derived owner and database creation time                   |
| `kind`, `promptVersion`, `attempt`, `latencyMs`, `outcome` | Call type, prompt revision, attempt and result                    |
| `provider`, `model`                                        | Provider/model when supplied; otherwise null                      |
| `providerEvents`, `problems`, `raw`                        | JSON retry/fallback events, verification problems and model reply |
| `inputTokens`, `outputTokens`, `guardrailVerdict`          | Nullable metadata requested in the #52 discussion for #98         |

The outcome enum matches the current `CoachOutcome`: `ok`, `retried`, `switched`,
`rejected`, `error`, `rule_based`. `kind` is `plan` or `chat`.

The sink maps these fields explicitly. It does not store a prompt, the profile
input, the whole record object or its error text. A `userId` added to a record
cannot override the owner bound to the sink. `raw` is the model reply, not the
request; replies can still contain user-related information and need the same
private access as the user's other records.

Missing token counts and verdicts stay null; zero token counts remain zero.
Absent optional JSON fields use SQL NULL. An explicit `raw: null` is JSON null.
Non-JSON values such as BigInt or circular objects fail the write; they are not
coerced into a partial record.

## Local setup

No new API keys, dependencies or environment variables are required. Start the
existing local PostgreSQL and apply the committed migration:

```bash
docker compose up -d
docker compose ps
npx prisma migrate deploy
npx prisma generate
npm run dev
```

Use the existing `.env` setup from [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md).
Restart an existing dev server after regenerating the client. The migration is
`20261112145130_coach_event`; it only adds enums, the event table, its index and
foreign key. It does not reset or rewrite existing application data.

The migration was generated on current main after #44 and #49 merged. If another
schema migration lands before this branch is integrated, update from main and
regenerate the unpublished coach-event migration on an isolated database rather
than editing its SQL or resetting a database with real data. Already deployed
migrations need a forward migration instead of rewriting their history.

## Connect an existing coach caller

`prismaCoachSink(userId)` returns the existing `CoachSink` interface. The caller
must authenticate first and use the verified server user's ID. The sink itself
does not authenticate HTTP requests or decide which access tiers may use AI.

For an existing plan Server Action, after loading and validating its inputs:

```ts
import { requireUser } from "@/lib/auth/session";
import { prismaCoachSink } from "@/lib/coach/coachSink";
import { generatePlan } from "@/lib/coach/generatePlan";

const user = await requireUser();
const result = await generatePlan(model, profile, library, {
  log: prismaCoachSink(user.id),
});
```

Here `model`, `profile` and `library` are the existing caller's validated inputs.
Keep any provider-event collector and other generation options alongside `log`.
Chat callers use the same sink with their existing logger. This change supplies
storage; it does not automatically enable logging for every application call.
The personalization and general chat entrypoints remain their owners' work.

`generatePlan` already writes through `writeRecord`, which catches sink failures
so logging cannot break a generated plan. Other callers should use that same
wrapper. Calling the sink directly returns the database/serialization rejection;
the sink does not hide whether an event was stored.

Read records only on the server, scoped to the authenticated user's ID:

```ts
const records = await prisma.coachEvent.findMany({
  where: { userId: user.id },
  orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  take: 50,
});
```

The foreign key enforces that the owner exists, and deleting that user removes
their records. It does not replace the caller's read-authorization checks.

## Compatibility with pending coach work

The nullable token/verdict columns are ready for PR #98, as requested in the
issue comment. A small optional metadata type in the sink accepts those fields
without changing the current `CoachRecord` producer contract. Older records
remain supported; missing metadata is null.

PR #99 adds `cached` to `CoachOutcome`. It is not part of current main and is not
silently accepted here. When that outcome lands, update the database enum with
a generated migration and extend the sink tests. The sink's typed assignment
makes a new unsupported outcome a TypeScript error rather than silently losing it.

## Verify without a live provider

Use a dedicated PostgreSQL database ending in `_test`, following
[ACCOUNTS.md](ACCOUNTS.md#automated-checks). Set `TEST_DATABASE_URL`, then run:

```bash
npm run db:migrate:test
npm run test:integration -- tests/integration/coach-sink.test.ts
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npm run test:e2e
```

The integration cases cover JSON and metadata round trips, per-user reads,
forged owner/prompt fields, all outcomes, null handling, cascade deletion,
failed writes and the real plan generator with a mocked model and database sink.
They never use a real provider key or the development database.
