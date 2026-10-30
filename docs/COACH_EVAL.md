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

## Results

Not run yet.
