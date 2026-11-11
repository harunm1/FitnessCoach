# Ozolcer and Bae (2025), offline policy evaluation of a multi-turn LLM health coach with real users

**Citation.** Ozolcer, M., and Bae, S. W. (2025). Offline policy evaluation of multi-turn LLM health coaching with real users. NeurIPS 2025 Workshop on Multi-Turn Interactions in Large Language Models. arXiv:2510.17173v2. Code and de-identified logs: https://github.com/stevenshci/NeurIPS-MTI-LLM
**Read:** all 9 pages, 8 Nov 2026.
**Feeds:** #76 point 1 (logging per model call), #64 (per-profile reporting), #63 (when the coach should use a tool or go long).

## What they did

- Web-deployed coach on Qwen3-235B-A22B (via API providers). Users upload an Apple Health export; a pipeline builds daily features (sleep, HRV, VO2max, activity) and ML predictions of stress, soreness and injury risk (R² 0.50, 0.28, 0.40). Tools: code executor, web search, email (reminders).
- Pilot: 7 students, eHEALS (health literacy) and General Self-Efficacy surveys first, then multi-day chats (typically > 1 hour, 30+ messages), a 1–5 star rating per reply; 350 turns, 280 rated (rating rate 0.80); IRB approved. Logged latency, tokens, tool use and outcomes, typing and tab-switch proxies.
- **Typed tool-outcome rubric:** web search succeeds with ≥ 1 URL and consistent evidence (+1), fails with none or a dead link (−1); code succeeds when it runs and draws a labelled plot (+1); email succeeds when the event exists with an ISO 8601 time (+1); no tool = 0.
- Coaching modelled as a user-conditioned POMDP with two decision heads, TOOL (none, search, code, email) and STYLE (concise, detailed). Offline policy evaluation over logs with SNIPS and AIPW, clipped importance weights (c = 50), session bootstrap CIs, calibration checks. A simulator with hidden archetypes (literacy × self-efficacy) tests a small early "curiosity" bonus for learning who the user is in the first two turns.

## Results

- Tool replies rated 4.02 vs 4.38 without (d = −0.40) and varied more (variance 0.94 vs 0.67); failed tools cost about half a star (code 4.09 vs 3.33). Tool success rates 80.7–85.7%; top failures: no URL, no chart.
- Ratings fell from 4.36 (turns 1–5) to 4.12 (15+); tool use peaked at 70% in turns 5–10, then 26%. Faster replies rated higher (< 10 s: 4.25; > 30 s: 3.98). Longer messages rated slightly higher (high-rated averaged 2,123 characters vs 1,275).
- Only 1.6% of rating variance was user identity overall, but per-archetype policy effects were large: always-use-tools was best on average (R_total 0.304) yet hurt low-literacy, high-self-efficacy users (satisfaction −1.436 vs no tools) and helped high-literacy, low-efficacy users.
- Simulator: the early curiosity bonus raised goal success 0.935 → 0.970, pass@3 0.95 → 0.98, and identified the user type sooner (6.4 → ~5.7 turns).

## Limits they state

Seven students; propensities reconstructed, not logged; weights conditioned on literacy only; no end-to-end training; simulator is lightweight.

## What it means for FitnessCoach

1. Log a typed outcome for every model call in `coachLog` (provider, model, fallback used, verifier pass or fail and which rule, latency), so failures are countable, not anecdotes.
2. Report evaluation per profile, never only an average: an average can hide a group the coach is hurting (#64).
3. Tool calls and long replies are high variance; in the chat screen (#63), fetch data or show a chart only when it answers the question, and keep latency visible (streaming, #56).
4. A short "learn who you are" step at the start (the onboarding quiz) is supported by their simulator result.
