# Coach eval: Groq against Gemini on the fixed test profiles

Round 1 (below) compared the providers on a capped exercise list. Round 2 sends the whole library and adds retries and provider fallback.

Issues #7 (provider choice) and #19 (the test profiles). Results feed proposal section 4 (#6).

## Round 1 criteria, written 30 October before any run

**What runs.** The ten profiles in `src/lib/coach/evalProfiles.ts` (different equipment, days a week and reported injuries), each sent once to each provider through `generatePlan` and the adapters in `src/lib/coach/providers.ts`: Groq `openai/gpt-oss-120b` in JSON mode and Gemini `gemini-3.5-flash` with a JSON response type. Same prompt, same exercise list, same day, provider defaults for temperature. The exercise list offered to the model is the strength exercises from free-exercise-db (the seed data) that fit the profile's equipment and injuries, below expert level, at most six per primary muscle, sorted by id, so both providers see identical input and the prompt stays inside free-tier token limits. The runner is `eval/coachEval.ts`; raw replies and timings go to `eval/results/`.

**Measures, in order of weight.**

1. First-reply pass rate: profiles whose first reply passes the verifier, out of 10. This is the main measure, because every retry costs the user a wait and a request.
2. Retries: profiles that needed the second attempt, with the verifier's reasons for the first failure.
3. Fallbacks: profiles that ended on the rule-based plan. The target is zero.
4. Latency per call, median and slowest.
5. HTTP errors, including free-tier rate limits, recorded separately from bad plans.

**Decision rule.** Groq stays (D4 in `docs/ARCHITECTURE.md`) unless Gemini is clearly better, meaning at least two more first-reply passes out of ten and no more fallbacks than Groq. Latency breaks a tie. A provider that hits its free-tier limit inside ten profiles is noted as a demo risk whatever its pass rate.

**Limits.** One run per profile per provider, so a one-profile difference is noise. The prompt is the current `buildPlanPrompt`; a prompt change means a rerun.

## Round 1 results, 30 October

| Measure                                      | Groq `openai/gpt-oss-120b` | Gemini `gemini-3.5-flash`         |
| -------------------------------------------- | -------------------------- | --------------------------------- |
| First reply passes the verifier              | 10 of 10                   | 10 of 10                          |
| Retries after a rejected plan                | 0                          | 0                                 |
| Fallbacks to the rule-based plan, first pass | 4, all from rate limits    | 2, all from server errors         |
| HTTP errors                                  | 9, all 429 (rate limit)    | 10, all 503 (service unavailable) |
| Time per reply, median and slowest           | 3.5 s, 5.6 s               | 9.9 s, 15.1 s                     |

**One change from the criteria.** In the first pass, with 3 seconds between profiles, four Groq profiles and two Gemini profiles got no reply at all because of HTTP errors. Those six were rerun the same day, one at a time with 30 to 65 seconds between calls, nothing else changed. The pass rate counts the first reply that came back for each profile. Files: `eval/results/2026-10-30-<provider>.json` and the `-rerun` files.

**Decision: Groq stays (D4).** Neither provider produced a plan the verifier rejected, so Gemini is not clearly better on the main measure, and Groq answered about three times faster. Both hit errors inside ten profiles, which is a demo risk for each: Groq refused calls 3 seconds apart and accepted them a minute apart, and Gemini returned 503 on about one call in three.

**What this means for the coach (#11).**

1. On a 429 or 503 the coach should wait and retry, or switch to the other provider, before counting a failed attempt. D4 names Gemini as the fallback; today `coachModel` picks one provider.
2. The verifier checks equipment, injuries, days and ranges, so 10 of 10 means the plans are safe and well-formed, not that they are good programs. Reading a few plans by hand belongs in proposal section 4.
3. The exercise list sent to the model has to be filtered and capped by the caller (here six per muscle, 32 to 85 exercises). The comment in `buildPlanPrompt` says the list is already filtered, so the coach route must do it.

## Round 2 criteria, written 30 October before the round 2 runs

**Why a second round.** Round 1 capped the list at six exercises per muscle to stay inside Groq's free-tier limit. The team wants every exercise in the library available to the coach, and round 1 lost profiles to rate limits and 503s that a retry would have absorbed.

**What changed in the code** (PR #30). The prompt offers every exercise the verifier would accept for the profile (equipment and injuries only; every category and level), grouped as `muscle (category): name; name`, and the model answers with names that code maps back to ids. On the full gym profile that is 694 exercises and about 4,700 prompt tokens, against 7,900 for the round 1 format (measured on Groq's tokenizer). Groq runs at low reasoning effort. A 429, 408, 5xx or network error is retried twice with backoff, or after the provider's Retry-After when that is 8 s or less; anything longer goes to the other provider when its key is set.

**Runs, in order.**

1. Groq alone, ten profiles, 65 s apart (the free tier allows 8,000 tokens a minute, so one full-library plan a minute).
2. Gemini alone, ten profiles, 15 s apart.
3. The production setup, Groq then Gemini, ten profiles 3 s apart, the way a burst of demo users would hit it.

**Measures.** The five from round 1, plus the size of the list offered, retries used, and in run 3 how many plans Gemini served.

**Decision rules.**

- Full library: kept if the lead provider passes the verifier on the first reply for at least 9 of 10 profiles (one profile of noise allowed against round 1's 10 of 10). Otherwise the list goes back to the team with the alternatives in the trade-offs table.
- Provider: the round 1 rule (Gemini must be clearly better to replace Groq as lead).
- Retry and fallback: kept if run 3 ends with no rule-based plans.

**Limits.** One run per profile per setting; a model or prompt change means a rerun. Free-tier limits are per account and change without notice.
