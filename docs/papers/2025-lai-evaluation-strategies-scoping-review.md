# Lai et al. (2025), evaluation strategies for LLM exercise and health coaches: scoping review

**Citation.** Lai, X., Lai, Y., Chen, J., Huang, S., Gao, Q., and Huang, C. (2025). Evaluation strategies for large language model-based models in exercise and health coaching: Scoping review. _Journal of Medical Internet Research_, 27, e79217. https://doi.org/10.2196/79217 (PMC12520646).
**Read:** full text via PubMed Central, including all three tables; the search-strategy appendix and PRISMA checklists were not opened, 8 Nov 2026.
**Feeds:** `docs/COACH_EVAL.md`, #64, final report evaluation section.

## What they did

- PRISMA-ScR scoping review; six databases (PubMed, Web of Science, Google Scholar, arXiv, medRxiv, bioRxiv), searched 31 July 2025 for March 2023 to July 2025; 3,147 records, 73 full texts, **20 studies** included; κ = 0.88 on screening.
- A custom 5-point Evaluation Rigor Score (ERS): real or simulated user setting; real user data; validated instruments; inter-rater reliability reported; a baseline or expert comparison. Not externally validated.

## Results

- 75% of studies used ChatGPT models; 40% plan generation, 35% behavioural or motivational coaching, 25% movement analysis.
- Human ratings in 80% of studies, automated metrics in 40%.
- **Median ERS 2.5 of 5**; 55% scored 1–2; only two scored 5 (GPTCoach and Strömel et al.'s fitness-narrative study). Only 45% reported inter-rater reliability; only 40% used real users or real data.
- Proposed direction: combine automated benchmarks with validated human ratings; ground advice with retrieval from ACSM and similar sources; replace Likert scales with granular yes/no rubric items ("Adaptive Precise Boolean" rubric), which they cite as giving higher agreement in about half the time.

## Limits they state

Commercial coaches excluded (no documentation); ERS is home-made; heterogeneous studies; no long-term outcomes in any study.

## What it means for FitnessCoach

1. Our evaluation can score well on their rigor criteria cheaply: a baseline comparison (with vs without `verify`, or plain prompt vs our chain), a validated instrument if we run any user test (e.g. SUS), and agreement reported if two of us rate plans.
2. Write rubric items as yes/no checks (as MoveBench's binary criteria do); most can be code checks on the plan JSON.
3. Report safety and reliability together in one table (verifier pass, guardrail tests, latency, fallback rate), which few studies do.
