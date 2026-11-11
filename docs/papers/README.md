# Paper notes

One note per paper the project cites, written after reading it so nobody has to re-read it to recall what it found. Each note gives the citation, what was read and when, the issues it feeds, what the authors did, the results, the limits, and what it means for FitnessCoach. A claim in an issue, the proposal or a report should match its note; where a note corrects an earlier summary, the correction is stated in the note.

| Paper                                                                                                       | Read                                                             | Feeds                  |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------- |
| [Sperandei et al. 2016, attrition in a fitness centre](2016-sperandei-attrition-fitness-center.md)          | Abstract only (not open access)                                  | Proposal §1            |
| [Gabay & Oravițan 2022, adherence in fitness facilities](2022-gabay-adherence-fitness-facilities-review.md) | All 16 pages                                                     | Proposal §1, #48, #63  |
| [Akrimi et al. 2025, ChatGPT plans for type 2 diabetes](2025-akrimi-chatgpt-plans-type-2-diabetes.md)       | Full article; supplementary plans not opened                     | #48                    |
| [Cemri et al. 2025, why multi-agent LLM systems fail](2025-cemri-why-multi-agent-llm-systems-fail.md)       | All 47 pages; long code traces in appendix N skimmed             | #22, #76               |
| [Jörke et al. 2025, GPTCoach (CHI '25)](2025-jorke-gptcoach.md)                                             | All 45 pages                                                     | #63, #76               |
| [Lai et al. 2025, evaluation strategies for LLM coaches](2025-lai-evaluation-strategies-scoping-review.md)  | Full text; search appendix and PRISMA checklists not opened      | #64, COACH_EVAL        |
| [Ozolcer et al. 2025, OPE health coach](2025-ozolcer-ope-health-coach.md)                                   | All 9 pages                                                      | #64, #76               |
| [Cheng et al. 2026, Think Fast, Talk Smart](2026-cheng-think-fast-talk-smart.md)                            | All 7 pages                                                      | #53, #76               |
| [Coach personas synthesis (#80), eight papers](2026-coach-personas-synthesis.md)                            | Full text for 1, 2, 4, 6, 8; abstract only for 3, 5, 7           | #80, final report      |
| [He et al. 2026, the AI recommendation paradox](2026-he-ai-recommendation-paradox-review.md)                | Main text and supplementary Appendices A–E; Appendix F not found | #48, #64, final report |
| [Ipeirotis & Rizakos 2026, voice AI oral exams (CACM)](2026-ipeirotis-voice-ai-oral-assessments.md)         | All 34 pages (arXiv authors' version)                            | #22, #76, personas     |
| [Jiang & Fowler 2026, EiPE grading (SIGCSE TS)](2026-jiang-fowler-eipe-grading.md)                          | **Not read**: open access but ACM blocked automated access       | #22                    |
| [Jörke et al. 2026, Bloom (CHI '26)](2026-jorke-bloom.md)                                                   | All 33 pages                                                     | #48, #63, #65          |
| [Lee et al. 2026, cross-model consistency](2026-lee-cross-model-consistency.md)                             | All 24 pages                                                     | #64, #65               |
| [Lee et al. 2026, repeated-generation consistency](2026-lee-repeated-generation-consistency.md)             | All 15 pages (supplement not in the arXiv PDF)                   | #64, #65               |
| [Li et al. 2026, FITTER](2026-li-fitter-guideline-grounded-prescription.md)                                 | All 45 pages                                                     | #64, #65, #76          |
| [Li et al. 2026, MoveBench](2026-li-movebench.md)                                                           | All 14 pages                                                     | #64, #65               |

Corrections found while reading in full (8 November 2026):

- FITTER's 98.5% safety figure is a model-assessed checklist score; clinicians rated 80.6% of plans safe.
- Bloom avoids numeric intensity targets on purpose; #65 rests on Lee et al., not Bloom.
- He et al.'s "5 of 6 inferior" does not match its own efficacy table (three head-to-head trials, all inferior), and two of those three trials are at high or serious risk of bias (Appendix C).
- Think Fast: GPT-OSS-120B, our Groq model, had the worst numeric error (2.0%); 0.7% is the average across models.
- Ipeirotis & Rizakos: moving the one-question rule into code cut stacked questions from 31% to 11%; it did not eliminate them.
- Gabay & Oravițan's figures for Sperandei (2016) differ from Sperandei's own abstract (63% before the third month, under 4% past twelve months); cite Sperandei directly.
