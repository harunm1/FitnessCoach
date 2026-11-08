# Lee (2026), cross-model consistency of AI-generated exercise prescriptions

**Citation.** Lee, K. (2026). Cross-model consistency of AI-generated exercise prescriptions: A repeated generation study across three large language models. arXiv:2604.19598 (preprint; Seoul National University Bundang Hospital). Follows Lee (2026) arXiv:2604.11287 and Choi et al. (2026), _J Clin Med_ 15(6):2457.
**Read:** all 24 pages, including supplementary prompts and the six case texts, 8 Nov 2026.
**Feeds:** #64 (repeat each profile and report consistency), #65 (numeric intensity per exercise).

## What they did

- Same six scenarios and prompt as the single-model study (12-week program, follow ACSM/ADA/OARSI, contraindications and precautions, all four components, RPE or heart rate for aerobic, %1RM for resistance).
- GPT-4.1, Claude Sonnet 4.6, Gemini 2.5 Flash, all at **temperature 0**, 20 runs per scenario per model (360 outputs).
- Measures: SBERT cosine over 190 pairs; **exact-duplicate count** (unique outputs); FITT intensity classification and binary safety categories, both by Claude Sonnet 4.6 (the author notes it also generated one arm, a self-evaluation risk). Author hand-checked 36 preprocessed outputs.

## Results

- Mean similarity GPT-4.1 0.955, Gemini 0.950, Claude 0.903 (all pairwise different; ranking flips by scenario, e.g. hypertrophy Claude 0.924 > GPT 0.911).
- **Temperature 0 was not deterministic and models behaved very differently:** unique outputs GPT-4.1 120/120 (100%), Claude 84/120 (70%), Gemini 33/120 (27.5%; knee OA case only 2 unique of 20). Gemini's high similarity came from repeating itself, not from stable reasoning.
- Intensity: clinical cases mostly low for GPT and Claude; Gemini left 26.2% of aerobic and 32.5% of resistance intensities unclassifiable in clinical cases (85% in the multimorbidity case).
- Safety language at ceiling for all three (3.93–3.99 of 4), so it does not separate models. In the multimorbidity case, Gemini had safety language in every output while 85% of its resistance intensities were missing: presence of warnings is not completeness.
- Author's conclusion: model choice is a clinical decision; decoding settings do not guarantee consistency.

## Limits they state

Temperature 0 only; one point in time; similarity is not clinical accuracy; six scenarios; one prompt; LLM judge shares a model with one arm.

## What it means for FitnessCoach

1. **#64:** repeat each eval profile several times per provider and report exact duplicates and verifier pass rate, not just similarity; temperature 0 will not make Groq or Gemini repeatable.
2. **#65:** intensity must be a required numeric field (RPE per exercise), rejected by `verify` when missing or out of range. A plan full of warnings with no intensity must fail.
3. Our provider choice (Groq gpt-oss-120b lead, Gemini fallback) should be justified by our own repeated runs, as the paper argues; record it in `COACH_EVAL.md`.
4. Counting safety phrases is a weak metric; our guardrail tests check behaviour (blocked or referred), which is the stronger test.
