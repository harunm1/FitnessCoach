# Cheng, Han and Sun (2026), Think Fast, Talk Smart: deterministic and neural computation in health text

**Citation.** Cheng, K.-C., Han, H., and Sun, D. Q. (2026). Think fast, talk smart: Partitioning deterministic and neural computation for structured health text generation. ICML 2026 Workshop on Structured Data for Health (SD4H). arXiv:2605.29652v1. Authors at Eight Sleep.
**Read:** all 7 pages including the full results table and trace, 8 Nov 2026.
**Feeds:** #76 point 1 (what code owns versus what the model owns), #53 (chat prompt built in code), final report architecture rationale.

## What they did

- Sleep-insight pipeline (TFTS): deterministic code formats the data, computes comparisons against baseline, ranks which metric to surface, gates causal attributions by evidence, and builds a compact "handoff" of verified facts; then **one bounded LLM writer call** turns them into a schema-constrained insight; deterministic assembly wraps it.
- Baselines: one-call structured zero-shot and few-shot prompting with the same rules in the prompt.
- **Layer replacement:** swap exactly one deterministic layer (comparison, ranker, attribution, handoff) for an LLM-generated typed artifact, keep the rest deterministic.
- 280 user-nights from 20 users; six models (GPT-5 nano, GPT-4o mini, GPT-OSS-20B, **GPT-OSS-120B**, Haiku 4.5, Sonnet 4.6). All metrics computed in code from saved JSON traces: schema error, numeric error (unsupported numbers), selection error (breaks the selection rule), attribution error (unsupported cause).

## Results

- TFTS: schema error 0% for all six; numeric error averaged 0.7%, worst 2.0% (**GPT-OSS-120B, our Groq model**); selection error 0%; attribution error ≤ 2.5%; also the cheapest per night.
- One-call baselines: zero-shot selection error 61–95%, numeric error 11–54%; few-shot still 63–71% selection error and up to 39% numeric error (GPT-OSS-120B 37.0%).
- Replacing one layer with the LLM: comparison → numeric error up to 26.7%; ranker → selection error 63–72%; attribution → unsupported attribution up to 43.6%; **handoff (writer interface) alone → numeric error 1.5–8.1%, attribution 7.8–16.8%**, even with every upstream fact deterministic.
- Their rule: code owns arithmetic, selection policy, evidence-gated attribution and the writer's input packet; the LLM writes prose within those bounds.

## Limits they state

Measures agreement with their own deterministic reference, not clinical optimality or causality; one domain (sleep); no human rating of helpfulness; open-ended clinical reasoning may need a different split.

## What it means for FitnessCoach

1. Strongest outside support for our design: the plan comes from a library pick plus `verify` in code; the model fills bounded slots and writes chat. Keep it that way.
2. **The prompt input is part of the safety boundary:** the profile and session lines handed to the chat model (#53) must be built in code from the database, never summarised by another model call.
3. Our Groq model was the weakest of six even inside TFTS (2.0% numeric error), so numbers in coach replies should be checked against the facts we passed in, or kept out of free text.
4. Evaluate from saved traces with deterministic metrics (schema, numeric, selection), as `coachLog` makes possible.
