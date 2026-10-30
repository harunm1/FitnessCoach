# Coach eval: Groq against Gemini on the fixed test profiles

Issues #7 (provider choice) and #19 (the test profiles). Results feed proposal section 4 (#6).

## Criteria, written 30 October before any run

**What runs.** The ten profiles in `src/lib/coach/evalProfiles.ts` (different equipment, days a week and reported injuries), each sent once to each provider through `generatePlan` and the adapters in `src/lib/coach/providers.ts`: Groq `openai/gpt-oss-120b` in JSON mode and Gemini `gemini-3.5-flash` with a JSON response type. Same prompt, same exercise list, same day, provider defaults for temperature. The exercise list offered to the model is the strength exercises from free-exercise-db (the seed data) that fit the profile's equipment and injuries, below expert level, at most six per primary muscle, sorted by id, so both providers see identical input and the prompt stays inside free-tier token limits. The runner is `eval/coachEval.ts`; raw replies and timings go to `eval/results/`.

**Measures, in order of weight.**

1. First-reply pass rate: profiles whose first reply passes the verifier, out of 10. This is the main measure, because every retry costs the user a wait and a request.
2. Retries: profiles that needed the second attempt, with the verifier's reasons for the first failure.
3. Fallbacks: profiles that ended on the rule-based plan. The target is zero.
4. Latency per call, median and slowest.
5. HTTP errors, including free-tier rate limits, recorded separately from bad plans.

**Decision rule.** Groq stays (D4 in `docs/ARCHITECTURE.md`) unless Gemini is clearly better, meaning at least two more first-reply passes out of ten and no more fallbacks than Groq. Latency breaks a tie. A provider that hits its free-tier limit inside ten profiles is noted as a demo risk whatever its pass rate.

**Limits.** One run per profile per provider, so a one-profile difference is noise. The prompt is the current `buildPlanPrompt`; a prompt change means a rerun.

## Results, 30 October

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
