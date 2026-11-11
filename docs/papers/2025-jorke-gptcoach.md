# Jörke et al. (2025), GPTCoach: towards LLM-based physical activity coaching

**Citation.** Jörke, M., Sapkota, S., Warkenthien, L., Vainio, N., Schmiedmayer, P., Brunskill, E., and Landay, J. A. (2025). GPTCoach: Towards LLM-based physical activity coaching. In _Proceedings of CHI '25_, ACM. https://doi.org/10.1145/3706598.3713819 (arXiv:2405.06061v2). Code: https://github.com/stanfordhci/gptcoach-chi2025
**Read:** all 45 pages (main text, references, appendices A to E including every prompt), 8 Nov 2026.
**Feeds:** #76 point 1 (separation of model steps), #63 (chat screen), #64 (evaluation), safety note.

## What they did

- **Formative study:** one-hour interviews with 12 health professionals (coaches, trainers, a physical therapist, a behavioural scientist) and 10 potential clients; thematic analysis (two coders on ~20%, one on the rest).
- **Three design principles:** DP-1 facilitative, not prescriptive ("passenger seat"); DP-2 tailor advice with qualitative and quantitative context; DP-3 supportive, non-judgmental tone. Coaches said prescriptive plans are not followed, and that advice without context costs trust ("How do I know that you have access to a pool?"). Data should guide, not drive.
- **System:** iOS app (Spezi, HealthKit, three months of data, per-source permissions) → Firestore → Python FastAPI backend that owns all LLM logic and tool execution → TypeScript/React frontend for chat and charts. GPT-4 (gpt-4-0613, temperature 1). Two tools: `describe(source, date, granularity)` returns a text summary; `visualize(...)` returns the same and renders a chart. Counts are summed and bar-charted, rates averaged and line-charted.
- **Prompt chain per user message:** (1) dialogue-state classifier ("continue" or "completed") over eight states from the Stanford Active Choices onboarding: onboarding, program, past experience, barriers, motivation, goal setting (FITT), advice, goodbye; (2) MI strategy picker, one of 11 adapted MISC strategies; (3) response generator conditioned on state and strategy ("brief, one question at a time"); (4) if no tool was called, a tool-call predictor ("would this generic reply be better with their data?") and (5) a tool-call generator. Key instructions are repeated at the end of the context because models follow instructions at the start or end of long contexts best.
- System prompt: coach persona, warm tone, **no medical or mental-health advice, refer to a professional**, brief replies, do only what the current stage asks. The Active Choices state prompts are copyrighted by Stanford; reuse needs written approval, so we do not copy them.

## Results

- Lab study, 16 participants (one hour each, 11 on Zoom, 5 in person; ages 21–71; 9 with an Apple Watch).
- Survey (1–5): supported 4.8, comfortable sharing concerns 4.8, personalized 4.6, actionable 4.3, unsolicited advice 1.8, used data relevantly 3.9, new insights 3.7. SASSI usability 82.4%; weakest were habitability 7.3/10 and speed 3.7/5.
- Dialogue: 28.5% of turns in goal setting; 59 tool calls, mostly in goal setting (35.6%) and advice (30.5%). Internal strategy was Question 65.7% of the time. Replies were 2–3 times as long as the user's and grew over the session despite "keep it brief".
- Human MITI coding (six coders, each transcript three times, mean ICC 0.79): 62.2% MI-consistent, 31.1% neutral, 6.7% inconsistent (all unsolicited Persuade, mostly late in the session). Coders: like a counsellor in training; too few reflections, too much information-giving, answers "change talk" with advice instead of drawing it out.
- **Counterfactual (chains removed, same system prompt), 160 simulated barrier replies, one blind coder:** MI-consistent 54.2% vs 43.9%; MI-inconsistent 3.5% vs 17.1%; Persuade in 8.1% vs 43.1% of replies; Question in 98.1% vs 20.0%. LLM-based MISC coding showed the same direction (inconsistent 14.5% vs 22.9%).
- Data use was uneven: charts shown without comment, data treated as fact without asking the user, wrong data derailed trust. Some users (often younger and active) wanted more specific plans; older or less active users were satisfied with high-level advice.
- Two unprompted citations of CDC and ACSM appeared; both happened to be correct, but the authors flag the risk of invented authority.

## Limits they state

Single supervised session, no behaviour change measured; iPhone owners only, all with post-secondary education; small sample; MI skill below a trained human; no retrieval; unsupervised use would need red-teaming for bias, accuracy, eating disorders and other sensitive topics.

## What it means for FitnessCoach

1. **Separation of concerns (#76 point 1):** their gains come from splitting one turn into decision steps (what stage, which strategy, whether to fetch data) before generation, all on the server. Our coach should keep the same shape: decide, then generate, then `verify`, each its own module behind `providers.ts`.
2. **#63 chat screen:** ask before advising (Question in nearly every reply), one question per message, a hard length cap enforced in code since the prompt alone did not hold it.
3. **Data honesty:** when the coach cites a logged workout or a plan value, it should say where it came from and let the user correct it, never treat it as fact.
4. **Scope and referral:** no medical or mental-health advice; refer out. Matches our code guardrails (#48).
5. **Evaluation (#64):** a chain-vs-plain-prompt ablation on scripted barrier messages is cheap and convincing; a rubric with human spot checks beats a single LLM judge.
6. Their stack split (Python backend owns all model calls, React frontend renders) is the same separation we keep in Next.js Server Actions and `src/lib/coach`.
