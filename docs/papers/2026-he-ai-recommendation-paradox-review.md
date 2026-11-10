# He et al. (2026), the AI recommendation paradox: systematic review of LLMs in exercise recommendation

**Citation.** He, T., Lu, D., Ma, Y., He, J., Li, D., Li, G., and Sun, J. (2026). The AI recommendation paradox: A systematic review evaluating the promise, peril, and path forward for large language models in exercise recommendation. _Biology of Sport_, 43, 949–970. https://doi.org/10.5114/biolsport.2026.158676 (open access). PROSPERO CRD420251075636.
**Read:** full main text, all three tables, Box 1 and references from the journal's HTML; the 7-page supplementary PDF (Appendices A to E: search strings and hits, custom quality checklists, risk-of-bias table for all 24 studies, RoB 2 plots, Box 2 case) read page by page in Chrome from PMC (PMC13343266), 8 Nov 2026. Appendix F is linked from the main text but is not in the supplementary PDF; not found.
**Feeds:** final report motivation ("why the verifier exists"), #48.

## What they did

- PRISMA 2020 systematic review to 19 June 2025; PubMed, Scopus, Web of Science, IEEE Xplore and grey literature; 756 records, 294 screened, 37 full texts, **24 studies** (11 in-silico expert evaluations, 7 HCI or user studies, 6 human interventions); κ 0.88 and 0.92. Narrative synthesis (no meta-analysis); RoB 2, ROBINS-I or a custom checklist.
- "Unsafe" defined from ACSM: an absolute contraindication for the population, a hazardous technique without warning, or missing pre-participation screening.

## Results

- **Efficacy:** three head-to-head trials against human-made programmes (Genç, Masagca, Pajo) all found the AI plan inferior (strength and lean mass, cardio endurance with no gains in women, jump performance). Three other studies found AI plans better than no programme or a basic model (one used RAG). The abstract says AI was inferior in "5 of 6 (83%)" head-to-head cases, but the efficacy table lists three human comparisons, all inferior; the two figures do not reconcile, so we cite the table, not the 5 of 6.
- **Safety:** systemic safety flaws in **14 of 24 studies (58%)**: contraindicated exercise (HIIT for proliferative retinopathy in Akrimi; heavy deadlifts with lumbar disc herniation in Dergaa), unsafe starting loads and heart-rate zones for an obese beginner (Saraç), missed contraindications. The opposite failure also appears: plans so conservative they would not work (Dergaa), and Zaleski found most inaccuracies came from over-recommending medical clearance.
- Quality: accuracy often fine, comprehensiveness poor (Zaleski 41.2%), college-level reading; quality depends on prompt detail and stays sub-optimal even with expert prompts.
- HCI: conversational plan co-creation and data narratives help motivation; one CHI study found GPT-4 just-in-time messages rated above health professionals'.
- Text-only models cannot check exercise form, a safety gap no plan check closes.
- **Box 1, risk zones:** green (healthy, no symptoms): LLM fine as an idea tool; amber (controlled chronic conditions, over 65 with mild limits, past injury): only as a draft a professional approves; red (unstable or complex conditions, absolute contraindications): no LLM guidance at all.

## Limits they state

Small, short, often high-risk-of-bias primary studies; fast-moving field; narrative synthesis; possible publication bias. (Authors also disclose Gemini was used for language editing.)

## What it means for FitnessCoach

1. Supports a code verifier and guardrails, not trust in the model: the documented failures are contraindications and unsafe starting loads, which rules can catch.
2. Adopt the risk zones as product scope: the quiz should route amber-zone answers (conditions, injuries, over 65) to a check-up note and conservative defaults, and red-zone answers to "see a professional" with no generated plan. Raise with Mohammad (quiz owner) at the next meeting.
3. Guard against the opposite failure too: a plan that is safe but too easy fails the user (Bloom users said the same).
4. Cite the 14 of 24 figure from the text; do not cite "5 of 6".

## From the appendices (supplementary PDF)

- **Search counts do not match the main text.** Appendix A lists 577 raw hits across nine sources and 294 after deduplication; the main-text flow reports 756 records. Cite 294 screened and 24 included, which both agree on.
- **The head-to-head evidence is weak.** Appendix C rates Genç (RCT) high risk of bias (supervision differed between arms), Masagca serious risk (no randomisation, no baseline fitness control) and Pajo moderate risk. Two of the three trials behind "AI plans were inferior to human plans" are at high or serious risk of bias, so the finding is directionally consistent but not strong evidence. Only one of the three RCTs (Strömel 2024) is low risk.
- Akrimi et al. (2025) is rated low quality (three author-raters, no blinding), which matches our own note.
- Highest-quality in-silico studies per the authors: Haag 2025, Oliveira 2024, Xu 2024, Zaleski 2024.
- **Box 2 is a ready test profile.** A 58-year-old sedentary man with medicated, stable hypertension asks for "a 3-day per week beginner workout plan"; ChatGPT-4 returned sets to failure, heavy deadlifts, all-out HIIT and burpees. The appendix shows only the flawed draft (the corrected plan is not in the PDF). We can add this profile to `evalProfiles` and expect the verifier to reject failure sets and HIIT for a beginner with a listed condition, and the safety note to recommend a check-up (#48).
