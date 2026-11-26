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

## Round 2 results, 30 October

| Run                                          | Profiles        | First reply passes the verifier | Served by the coach (not the rule-based plan) | Provider errors                                     |
| -------------------------------------------- | --------------- | ------------------------------- | --------------------------------------------- | --------------------------------------------------- |
| 1. Groq alone, full library                  | 4, then 2 rerun | 1 of 4; 1 of 2 on the rerun     | 1 of 4; 1 of 2                                | 3, all 429                                          |
| 2a. Gemini 3.5 Flash alone                   | 5               | 0 of 5                          | 0 of 5                                        | 10, all 429 (daily free-tier cap)                   |
| 2b. Gemini 3.5 Flash-Lite alone              | 5               | 2 of 5                          | 5 of 5                                        | 0                                                   |
| 3. Groq, then Gemini Flash-Lite (production) | 10              | 9 of 10                         | 10 of 10                                      | 9 Groq limits absorbed: 3 retried, 6 sent to Gemini |

Files: `eval/results/2026-10-30-groq-round2.jsonl`, `-groq-round2b.jsonl`, `-gemini-round2.jsonl`, `-gemini-round2-lite.jsonl`, `-chain-round2.jsonl`.

**Why runs 1 and 2 stopped before ten profiles.** Run 1 was stopped after four profiles because the full library exposed faults in matching the model's answers to the library: names the library does not hold ("Incline Dumbbell Bench Press", "Cable Triceps Pushdown") and a plank written as 60 reps (`-groq-round2.jsonl`, gym-5-days and machines-6-days). Each got a code or prompt fix and a test, two profiles were rerun to check the fix (`-groq-round2b.jsonl`), and the remaining profiles moved to run 3. Two further faults turned up after run 1: the near-miss name "Standing Calf Raise" for "Standing Calf Raises" in run 2b (`-gemini-round2-lite.jsonl`), and the group label copied into the name in run 3 (`-chain-round2.jsonl`), in the shoulder profile's first reply, which is the one first reply that failed. Run 2 stopped after five profiles because Gemini 3.5 Flash's free tier allows 20 requests a day and every call returned 429; Flash-Lite served the same five profiles, so it became the fallback model (`GEMINI_MODEL` in `.env`).

**Decisions against the criteria.** Full library kept: the production chain passed the verifier on the first reply for 9 of 10 profiles, the threshold set before the run. Groq stays the lead provider: Gemini was not clearly better. Retry and fallback kept: run 3 ended with no rule-based plans.

## Replay in CI (3 November)

`src/lib/coach/evalReplay.test.ts` runs the ten round 2 replies back through `generatePlan` and the verifier on every pull request, with no keys or network; `eval/fixtures-library.json` holds the 106 exercises those replies name, copied from free-exercise-db. Every profile still ends in a verified coach plan in no more attempts than recorded. The shoulder profile's first reply, which failed on 30 October because the model copied the prompt's group labels into exercise names, now passes first time since name matching strips the label; a test pins that. Replayed through the current code, the recorded first replies pass the verifier for 10 of 10 profiles, against the 9 of 10 measured on 30 October. The live run (`eval/coachEval.ts`) stays manual because it needs keys and spends the free-tier quota.

## Chat replies (24 November, #142)

**Criteria, written before any run.** A reply to a message that raises no topic must be under 80 words (a reply of 80 is flagged) and at most 4 sentences, the chat prompt's own limit (`chat-v5`), unless the user asks for detail, and must carry no recovery, pain or nutrition line. A notice is allowed for exactly the topic the message raises. `eval/chatChecks.ts` applies this to one reply with word lists, not a model: it is a screen, so a clean result does not prove the reply is good, and a hit needs a human read. The patterns are our own wording, not from a published scheme.

**Cases.** `eval/chatCases.ts` holds eight fixed messages with the quiz answers from #142 (lose body fat, both, trained for years, three days, all equipment). The first is the floor-press question that drew the long answer on 22 November. Six reach the model; the pain report and the diet question are answered by the code guardrail, so they have no model reply to check and stay as cases for the topics they raise.

**Run.** `npx tsx eval/chatEval.ts groq` (or `gemini`) sends the six model cases once each with no retries and appends `eval/results/<date>-<provider>-chat-chat-v5.jsonl`; `GEMINI_MODEL` can name a cheaper Gemini model; `GROQ_MODEL` must stay a gpt-oss model, because the request always sends `reasoning_effort`. The runner uses the app's prompt and request settings but not the model safety check, and each row records the model. No live run was made on 24 November, so there is no result yet. CI runs only the checks and the case list (`eval/chatChecks.test.ts`).

**Limits.** The 22 November reply is not kept; the issue quotes one line ("aim for 48 h of light activity") and describes a joint-pain line and a nutrition line, so the test's long reply writes those two to match; the patterns also carry other wordings from a review, each with a test. Sentences are counted by end marks, so a bulleted reply is limited by its word count only, and rest time between sets is not flagged (the plan gives rest) although the prompt forbids unrequested rest-time advice. One run per case says little about variance; use it as a screen after a prompt change, then repeat the cases that hit.

## The user's own data (26 November, D43)

**Why.** On 25 November at 17:20 the live coach was asked to "review my hevy import history, and weight loss" and answered that it had no access to the import history or the weight entries, and to see a trainer. The prompt (`chat-v5`) held no import or body-weight data. `chat-v6` gives the coach four tool results for the signed-in user on every turn (D43 in `docs/ARCHITECTURE.md`).

**Criteria, written before any run.** Three checks are added to `eval/chatChecks.ts`, as screens like the ones above: every number in a reply must appear in a tool result, a plan line, the days a week or the user's message (`ungroundedNumbers`; a date counts by its parts, thousands separators and a minus sign are ignored, so a rounded "about 3 kg" for a 3.2 kg change is flagged and needs a human read); a reply must not say it cannot see, view or access the user's data (`claimsNoAccess`); and a case can name numbers the reply must give (`missingCites`). The new first case, `import-weight-review`, is the 25 November message on a seeded fixture, never his account: 412 workouts imported from Hevy (14 Mar 2024 to 20 Nov 2026) and a body weight from 84.2 to 81 kg over the last 90 days. Its reply must give 412 and 3.2, claim no lack of access, and keep every number grounded. It passes if one run on Groq shows none of the three violations; the old cases keep their checks, with the grounding check added. The 25 November reply, as recorded in the report, fails two of the three checks (`eval/groundingChecks.test.ts`).

**Run.** `npx tsx --env-file=.env eval/chatEval.ts groq` now sends seven model cases and appends `eval/results/<date>-groq-chat-chat-v6.jsonl`.

**Result, 26 November, one Groq run (`openai/gpt-oss-120b`, `eval/results/2026-11-26-groq-chat-chat-v6.jsonl`).** `import-weight-review` passed all three checks: the reply gave the 412 imported workouts with their dates and the drop from 84.2 to 81 kg (3.2 kg, about 0.27 kg a week) over the last 90 days, named that period, and made no claim that it could not see the data. Of the six older cases, four had no violation. Two were flagged `ungrounded-number`, and on a human read neither number is a claim about the user's history: `rest-days` advised "1 to 2 full rest days", and `brace-detail` (which asked for detail) used a numbered list ("1.", "2.", "3."); `brace-detail` also carried an unrequested stop-on-sharp-pain line, the prompt's own pain rule. So the grounding check, as written, also flags advice numbers and list markers; it is a screen for numbers about the user's data, and a hit needs a read. Changing it to skip list markers is a follow-up, not made after this run.

**Added after the run (verifier, 26 November).** The issue also asks that the reply name the period it used, which the three checks did not test. A fourth check, `missing-period`, now needs one of the case's period phrases ("90 days", "28 Aug", "12 weeks", "3 months"), as whole words ("190 days" does not pass for "90 days"), ignoring case and the kind of space: the recorded reply wrote "90 days" with a narrow no-break space, and it passes. The check was written after the run, so this is a recheck of the stored reply, not a new run. CI never sends the 25 November message to a model: it tests the built prompt (unit and integration), the checks on a written good reply and on the 25 November reply, and the stored reply above is the only live answer. Not handled: a zero-width space, markup inside the phrase ("**90** days") and "90-day"; a screen, so a miss needs a read.
