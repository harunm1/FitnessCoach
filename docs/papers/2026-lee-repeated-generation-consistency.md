# Lee (2026), consistency of AI-generated exercise prescriptions: a repeated-generation study

**Citation.** Lee, K. (2026). Consistency of AI-generated exercise prescriptions: A repeated generation study using a large language model. arXiv:2604.11287 (preprint; Seoul National University Bundang Hospital).
**Read:** all 15 pages (the supplementary prompts and case texts are referenced, not included in the arXiv PDF), 8 Nov 2026.
**Feeds:** #64 (evaluation), #65 (stability of generated plans), `verify` rules for numbers.

## What they did

- Six hypothetical scenarios: four clinical (type 2 diabetes with obesity; knee osteoarthritis with fall risk; recovery after colon cancer surgery; hypertension, diabetes and obesity) and two healthy adults (fat loss; hypertrophy). Cases 1–3 come from Choi et al. (2026), whose expert raters agreed poorly (ICC 0.139).
- Gemini 2.5 Flash via Vertex AI, temperature 1.0, same structured prompt 20 times per scenario (120 outputs); the prompt asks for all four components and %1RM for resistance intensity.
- Claude Sonnet 4.6 stripped greetings and formatting, then acted as a separate judge to classify FITT (frequency, intensity, time, type) for weeks 1–4: aerobic low < RPE 12 / < 64% HRmax / < 3 METs, moderate RPE 12–13 / 64–76% / 3–5.9 METs, high above; resistance low < 50% 1RM, moderate 50–69%, high ≥ 70%; otherwise "unclassifiable". Semantic consistency by SBERT (all-MiniLM-L6-v2) cosine over 190 pairs per scenario. Safety: presence of contraindications, precautions, symptom monitoring and risk warnings, plus sentence counts. Author hand-checked 18 of 120 extractions.

## Results

- Semantic similarity high everywhere (mean 0.879–0.939); highest for the tightly constrained cases (post-cancer 0.939, knee OA 0.933), lowest and most variable for hypertrophy (0.879, SD 0.052).
- Clinical cases: aerobic intensity low in 90–100%, resistance low in 75–85%, but **10–25% of resistance intensities were unclassifiable** despite the prompt asking for %1RM. Healthy cases shifted to moderate or high. Hypertrophy frequency was unstable (the most common pattern only 35%). Session time sometimes estimated rather than stated.
- Safety content present in 100% of outputs; the amount varied widely with scenario (total safety sentences 26.9 to 61.4; H = 86.18, p < 0.001).
- The author's point: high text similarity is not clinical equivalence; 50% vs 70% HRmax reads alike to an embedding.

## Limits they state

One model; safety judged by presence and count only; the LLM classifier was not validated against experts; six scenarios.

## What it means for FitnessCoach

1. Numbers are where the model drifts. Every plan field that matters (sets, reps, rest, intensity, minutes) must be a typed field in `schema.ts`, checked in `verify`, never free text. A missing or unparseable intensity is a verifier failure, not a pass.
2. Run each evaluation profile several times and report how often the plan changes (#65); a single run hides instability.
3. Do not use embedding similarity as evidence that two plans are the same; compare the structured fields.
4. Constrained profiles converge, open goals (hypertrophy) wander, so test open-goal profiles hardest.
