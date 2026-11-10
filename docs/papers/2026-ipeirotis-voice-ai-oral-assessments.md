# Ipeirotis & Rizakos (2026): scalable and personalized oral assessments using voice AI

## Citation

Ipeirotis, P., & Rizakos, K. (2026). Scalable and personalized oral assessments using voice AI. _Communications of the ACM_. https://doi.org/10.1145/3831714. Authors' version: arXiv 2603.18221v3 (26 July 2026).

## Read

All 34 pages of the arXiv authors' version (main text, Appendices A–F, references). 8 November 2026. The ACM Version of Record was not reachable (dl.acm.org blocks automated access); the arXiv copy states it is the authors' version of the CACM paper.

## Feeds

#22 (coach architecture), #76 point 1 (AI separation), coach personas (8 Nov design review), #63 and #70 chat.

## What they did

Field report, not a controlled study. A voice agent ran personalised oral final exams for an NYU Stern AI/ML product course, 36 students in Fall 2025 and 37 in Spring 2026. The exam is split into three single-purpose agents (authentication, project discussion, case discussion), with only per-session variables passed between them. A council of three models (Claude, Gemini, GPT-5) grades each transcript: independent scores on a five-dimension 0–4 rubric, a deliberation round where each sees the others' full output under neutral labels, then a chair model synthesises. Fixes were shipped between cohorts.

## Results

- Five failure modes in Fall 2025: stacked questions, paraphrasing when asked to repeat, treating thinking pauses as dropped calls, non-random case selection, and a harsh voice.
- Question stacking: prompt rules ("NEVER ask two questions") helped but did not stop it. A code-side turn validator that detects a multi-question turn and asks for a single-question rewrite cut stacked turns from 31.2% (191/612) to 10.9% (122/1,115). That is a large reduction, not elimination.
- Paraphrasing on repeat stayed a prompt-only mitigation; it was reduced, not fixed.
- Randomisation: told to "randomly select ONE case" from eight, the model picked Zillow in 6 of 7 exams; with Zillow removed it picked Predictive Policing in 14 of 22. Drawing a seed in code and mapping it to a case gave all eight cases used, maximum share 22% (8/37).
- Voice persona: a cloned professor's keynote voice was described as "aggressive", "condescending", a "sports coach" style; a calm preset voice removed the complaints.
- Grading council: perfect three-way agreement rose from 29% to 74% (Fall) and 49% to 86% (Spring) after deliberation; Krippendorff's alpha 0.52 to 0.86 and 0.65 to 0.90 (dimension-pooled). Gemini was consistently lenient; Claude and GPT-5 agreed almost perfectly (pairwise alpha 0.97 and 0.99). Exams are flagged for human audit by a rule on the strict pair's disagreement (about 3% in Spring).
- Cost: under one dollar of grading LLM spend per exam within a $99/month voice subscription; about $3.40 per 30-minute exam above the subscription.
- Students: 70% and 66% felt it tested their understanding; "more stressful than written" fell from 83% to 63% as fixes shipped.

## Limits

One course, one institution, two cohorts; the authors call the numbers instances, not estimates. Reliability (rater agreement) is shown; validity against blinded expert grading is not. Several fixes changed at once between cohorts, so effects cannot be attributed to single fixes. The Spring grading cost is reconstructed, not billed.

## What it means for FitnessCoach

- The #22 summary is right in direction but should be precise: moving the rule into code reduced stacking from 31% to 11%; it did not remove it, and the code check works by detecting and requesting a rewrite. Our verifier follows the same pattern (detect, reject or repair, log).
- Pattern 1 (single-purpose modules) backs the coach layout: plan generation, plan verification, chat and safety notes stay separate modules in `src/lib/coach/`, with only typed data passed between them (#76 point 1).
- Pattern 3: anything that must be uniform or random (exercise rotation, picking a substitute) is chosen in TypeScript, never by asking the model.
- Personas (8 Nov review): the strongest evidence in our reading against a harsh default. A high-intensity "sports coach" register read as aggressive and stressful to users. If a drill-sergeant persona is offered, it should be opt-in, change wording only, and leave the plan, verifier and safety notes identical across personas.
- A multi-model council is not needed for our scale; the useful transfer is the audit rule idea: flag outputs where independent checks disagree, rather than trusting one model's judgement.
