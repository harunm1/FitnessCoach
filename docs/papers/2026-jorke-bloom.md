# Jörke, Genç, Teutschbein et al. (2026), Bloom: designing for LLM-augmented behaviour change interactions

**Citation.** Jörke, M., Genç, D., Teutschbein, V., Sapkota, S., Chung, S., Schmiedmayer, P., Campero, M. I., King, A. C., Brunskill, E., and Landay, J. A. (2026). Bloom: Designing for LLM-augmented behavior change interactions. In _Proceedings of CHI '26_, ACM. https://doi.org/10.1145/3772318.3790506 (arXiv:2510.05449v2). Code, prompts, harm taxonomy and 600-example safety benchmark: https://github.com/StanfordHCI/Bloom
**Read:** all 33 pages (main text, references, supplementary A to C with every survey table), 8 Nov 2026.
**Feeds:** #48 (guardrail categories), #63 and #70 (what the chat may change), #65 (see correction below), #64, final report.

## What they built

- iOS app (React Native + Swift, Spezi, HealthKit) for people in early stages of change with low or moderate activity. Python FastAPI backend, GPT-4o (gpt-4o-2024-11-20), Firestore.
- LLM coach "Beebo" in three modes: onboarding, weekly check-in, at-will chat. Reuses GPTCoach's dialogue-state and motivational-interviewing chains (dropped the tool-call chain: too many needless queries, too slow). Summary memory of past chats (< 3,500 tokens even for daily users).
- Tools: `query_health_data`; `generate_plan` returns a weekly plan as **structured JSON** (per activity: type, intensity as a category such as "moderate", duration, time); `add_workout` / `delete_workout`.
- **Tool guardrails in code:** the agent cannot leave the goal-setting state until `generate_plan` has actually been called (without this it told users it had made a plan when it had not). The at-will chat is **not** given `generate_plan`: hallucinated tool calls caused destructive edits, so it only gets small add/delete edits.
- Plans follow Active Choices and CDC guidance; Bloom deliberately does **not** set generic numeric targets (minutes or steps per day); the coach suggests scaling back plans that look too ambitious and adds strength or flexibility once aerobic guidelines are met.
- Non-chat interactions: weekly plan, HealthKit activity linking, LLM-annotated charts, a garden ambient display on the lock screen, LLM-written morning, evening and post-activity notifications.
- **Safety filters:** a five-category harm taxonomy built from red-teaming interviews with four experts: (1) bodily harm or overexertion, (2) body image and eating disorders, (3) mental health, (4) negative mindsets and feedback (guilt, self-worth), (5) inaccurate or out-of-scope advice. One few-shot classifier per category returns harmful yes/no with a rationale; a flagged reply is **rewritten by a revision prompt** before the user sees it. Benchmark: 100 train, 400 validation, 100 external test written by ten outside researchers (7 of 100 were mislabelled, so a corrected set is also reported). Strict accuracy 0.92 validation, 0.85 test, 0.91 corrected; relaxed recall ≥ 0.96 on every split. After revision, 1.15% (validation) and 0.18% (corrected test) of harmful messages were still harmful.

## Field study

- Four weeks, randomized, N = 54 (26 Bloom, 28 control without any LLM: UI plan builder, template notifications, no chat or summaries). 2,397 screened, 342 eligible; Apple Watch owners; skewed to higher income and education.
- Both groups increased activity a lot (H1: +1,680 steps/day, +13.2 exercise min/day, d = 0.59–0.75); meeting 150 min/week went 36% → 72%. **No significant difference between groups** (H2, H3 underpowered; d −0.22 to 0.23); control rose more at first, treatment held steadier.
- Treatment showed larger gains in mindset: activity-adequacy belief +1.21 vs +0.76, satisfaction with activity +1.41 vs +1.02, "I am an active person" +0.84 vs +0.25 over 28 days, "exercising is easy" +0.56 vs +0.10 (descriptive only, no significance tests on surveys).
- Treatment plans were more balanced (1.9 vs 1.4 of aerobic, strength, flexibility) and varied (3.8 vs 2.5 activity types); completion 87% vs 83%; 5.6 times more time in the app.
- Users credited plans, notifications and the garden, not chat, as the main source of accountability; chat helped by flexibly rescheduling and substituting.
- Complaints: verbose and repetitive replies (shortening by prompt reduced perceived empathy, so they let it stay long); safety filter over-triggering ("go see a doctor... okay, I know"); a coach that would not push ("talking me out of doing the work"); the bot answering app-bug questions with confident wrong answers or promising to "fix it later"; usability fell more in the LLM arm (SUS −11.6 vs −4.7).

## Limits they state

Four weeks; underpowered between groups; paid, self-selected, higher-SES sample; control had no rule-based chatbot; prompt-only agent (no fine-tuning or multi-agent).

## What it means for FitnessCoach

1. **#48 guardrails:** add their categories we lack: body image and eating, mental health, and negative mindsets (guilt, self-worth framing). Use their public benchmark for test cases. Keep a referral line that does not fire on every mention of feeling unwell, since over-triggering annoyed users.
2. **#63 and #70 chat:** the chat should only make small, verified edits (swap or add one exercise) through code, never regenerate the whole plan; the plan step is enforced in code, not trusted to the model saying it happened. The coach must say it cannot help with app problems instead of guessing.
3. **#65 correction:** Bloom stores intensity as a category (light/moderate/vigorous), not a numeric RPE, and avoids numeric targets on purpose. It supports structured FITT fields, but it is **not** a source for a numeric RPE per exercise; the Lee papers are. The issue text should cite Lee for the number and Bloom only for structured plans.
4. Structured plan JSON and a code-checked balance score (aerobic, strength, flexibility present) match our `schema.ts` and the #71 strength gap.
5. Expect no short-term activity difference from the LLM itself; frame our evaluation around plan quality, safety and verifier results, not behaviour change.
