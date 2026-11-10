# Li et al. (2026), FITTER: guideline-grounded multi-agent exercise prescription

**Citation.** Li, X., Lin, Y., Wu, Y., Wang, F., Wang, M., Gary, R. A., Kariuki, J., Smith, J., Billinger, S. A., Xiao, C., Hu, X., and Yan, R. (2026). A guideline-grounded multi-agent framework for personalized exercise prescription from clinical and wearable data. arXiv:2611.03983v1 (preprint, 2 Nov 2026, not peer reviewed). Code: https://github.com/carolli07/fittvp
**Read:** all 45 pages (main text, tables, references, supplementary notes 1 to 6), 8 Nov 2026.
**Feeds:** #76 (coach separation, verify design), #64 and #65 (evaluation), #71 (missing strength, equipment).

## What they built

- Input: a structured participant profile from All of Us records (EHR, Fitbit, surveys), plus simulated goals, readiness, stress, social setting and equipment, kept separate from observed data.
- Baseline activity from weekly wearable totals: sedentary (< 35,000 steps or > 4,500 sedentary min), moderately active (≥ 70,000 steps and ≥ 150 min MVPA), otherwise low active. Sets starting dose and progression rate.
- Safety constraints S built **before** generation from three screens: a fixed profile screen (conditions, vitals, fall risk, ADL limits, plus a points-based risk score), a medication screen (DailyMed labels mapped to seven exercise-relevant categories such as QT prolongation, neuropathy, bleeding), and an LLM review that may add concerns but never remove or weaken one. A fixed mapping turns each concern into constraints (intensity ceiling such as RPE 6, prohibited activity, frequency/time/volume bound, progression restriction, stop criterion), each naming the fields it governs.
- Five sequential agents, each seeing the profile, S, its own retrieved guideline passages and all upstream outputs: Type → Frequency → Intensity and Time → Volume (computed: sessions × minutes) → Progression (six two-week blocks; duration before frequency before intensity; regression cuts load 20–30% for a week).
- Retrieval per decision: ACSM position stand, AHA/ASA stroke statement, ACS guideline, ADA statement; 350-word passages with 60-word overlap (289 passages), bge-base-en-v1.5 + FAISS, at most 8 passages per agent, no more than 3 per source and 2 per section.
- **Deterministic audit and repair** after generation: every field checked against every applicable constraint and against dependent fields; on a violation, fix the field as the constraint specifies, recompute dependents (Type/Intensity change → progression blocks; Frequency/Time change → weekly Volume), re-check, repeat until clean or no deterministic fix exists. Logs original value, revised value, triggering constraint and the repair for every modified field.
- Backbone Qwen3.5-9B, greedy decoding, run inside the All of Us workbench (no data export). Safety judged by a separate GPT-5.4-family model against the checklist S.

## Results

- 400 participants (300 cancer, 100 stroke), six systems, 2,400 prescriptions; ablation adds 900.
- Model-assessed safety (no checklist violation): FITTER 98.5% (cancer 99.0%, stroke 97.0%); Vanilla 75.8%, CoT 84.2%, ReAct 82.8%, Self-Refine 85.8%, Collab 77.8%. Discordant pairs 55–95 in FITTER's favour against 4–6 the other way.
- Ablation (300 cancer): full 99.0%; no retrieval 82.0% (−17.0); no LLM safety review 76.3% (−22.7); no deterministic audit and repair 62.0% (−37.0). The rule-based step is the largest single contributor.
- Concreteness composite 0.552 vs 0.529 Vanilla (small, rank-biserial 0.11); ranking flips under equal weights (Vanilla first). Their own reading: it shows dosing precision, not concreteness in general.
- Guideline alignment (embedding cosine) 0.768 vs 0.724–0.734; they note it does not show clinical appropriateness.
- Clinicians (80 FITTER plans, one reviewer each, four reviewers): safety 80.6%, concreteness 83.1%, effectiveness 75.6% (stroke 62.5%), personalization 71.2%, acceptability 68.1%; 37 accepted as written, 35 with changes, 8 not. **Clinician safety is 18 points below the model-assessed 98.5%**, because the checklist can only enforce what the structured record carries (narrative drug use, beta-blockers blunting heart rate, visual impairment, severe pain).
- Top clinician themes: missing guideline-recommended component such as strength (19 reviews); equipment or stated goal not reflected, e.g. a recumbent cycle the patient does not own (19); starting dose not matched to measured activity (14); little detail for non-aerobic work, no sets or reps (13).
- More generic reasoning (CoT, Self-Refine, ReAct, Collab) did not uniformly help; Vanilla was best of the comparators on concreteness and alignment and worst on safety.

## Limits they state

One small backbone, so framework and model effects are confounded; model judge, not validated against clinicians (no overlapping ratings); one reviewer per plan, no inter-rater agreement; themes coded by one investigator; simulated goals and equipment; wearable owners only; uniform step thresholds ignore age and sex; no prospective outcomes. Competing interest: S. A. Billinger leads one of the four guidance documents.

## What it means for FitnessCoach

1. Confirms the split in `src/lib/coach`: the model proposes, code enforces (`verify`, `verifyRunning`, guardrails). A model critiquing itself (Self-Refine) did not close the gap.
2. Gap in `verify`: it rejects. FITTER repairs where the rule defines the fix, recomputes dependent fields, re-checks, and logs before, after and the rule. Worth adopting for rules with a defined fix (sets, rest, weekly volume), with every repair written to `coachLog`.
3. Their two proposed checks match our #71 bug exactly: a **component-completeness check** (every plan has the required strength component) and a **profile-consistency check** (exercises only use equipment the user has). Both are deterministic and belong in `verify`.
4. Constraints are built before generation and passed into the prompt, then enforced after. Our safety note and guardrails could follow the same order.
5. Evaluation: report a model-assessed rule pass rate and a human spot check side by side and never present the first as "safe"; report a with/without-`verify` ablation; report per profile (#64).
