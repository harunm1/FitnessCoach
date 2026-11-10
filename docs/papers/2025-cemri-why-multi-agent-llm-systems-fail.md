# Cemri, Pan, Yang et al. (2025), why do multi-agent LLM systems fail?

**Citation.** Cemri, M., Pan, M. Z., Yang, S., Agrawal, L. A., Chopra, B., Tiwari, R., Keutzer, K., Parameswaran, A., Klein, D., Ramchandran, K., Zaharia, M., Gonzalez, J. E., and Stoica, I. (2025). Why do multi-agent LLM systems fail? NeurIPS 2025 Datasets and Benchmarks Track. arXiv:2503.13657v3. Data and annotator: https://github.com/multi-agent-systems-failure-taxonomy/MAST
**Read:** all 47 pages (main text, references, appendices A to N including the intervention prompts and failure examples; long code traces in appendix N skimmed for the failure each one illustrates), 8 Nov 2026.
**Feeds:** #22 and #76 point 1 (why the coach is one model call behind code checks), final report architecture rationale.

## What they did

- 1,642 execution traces from seven open multi-agent frameworks (ChatDev, MetaGPT, HyperAgent, AppWorld, AG2/MathChat, Magentic-One, OpenManus) on coding, maths and general-agent tasks, mostly GPT-4o and Claude 3.7 Sonnet, plus 400 traces on open models (Qwen2.5-Coder-32B, CodeLlama-7B).
- Grounded-theory analysis of 150 traces by six experts (20+ hours each) produced the taxonomy MAST; three annotators reached Cohen's κ = 0.88; out-of-domain check κ = 0.79. An o1-based LLM annotator matched humans at κ = 0.77 (accuracy 0.94) and labelled the rest.
- Failure rates of the frameworks on their tasks: 41% to 86.7%.

## The taxonomy (share of failures across the dataset)

- **System design and specification (44.2%):** disobey task spec 11.8%, disobey role 1.5%, step repetition 15.7%, loss of history 2.8%, unaware of when to stop 12.4%.
- **Inter-agent misalignment (32.3%):** conversation reset 2.2%, failing to ask for clarification 6.8%, task derailment 7.4%, information withholding 0.8%, ignoring another agent 1.9%, reasoning–action mismatch 13.2%.
- **Task verification (23.5%):** premature termination 6.2%, no or incomplete verification 8.2%, incorrect verification 9.1%.
- Verifiers often only did superficial checks (does it compile, any TODOs) even when told to be thorough; a chess program passed review yet broke the rules of chess. Verification failures also appeared in runs that "succeeded".

## Interventions

- Better role prompts and a verification section, or a new topology (solver, coder, verifier; only the verifier may stop): gains were small and inconsistent (e.g. AG2 with GPT-4 not significant, p = 0.4; with GPT-4o significant, p = 0.03). ChatDev: role hierarchy +9.4%; adding a high-level objective check +15.6%. Topology changes helped more than prompt changes, but success stayed low.
- Their conclusion: many failures come from system design, not the base model; verification needs multiple levels (low-level correctness and the actual objective), ideally tests and external knowledge, not the model reviewing itself.

## Limits they state

Taxonomy not exhaustive; an LLM annotator labels most of the data; tasks lean to coding and maths; closed systems (e.g. Manus) could not be traced.

## What it means for FitnessCoach

1. Supports our choice of one coach call with roles fixed in code rather than several agents talking to each other (#22).
2. Verification must check the goal, not just the format: `verify` should test that the plan satisfies the user's constraints (equipment, strength component, days), not only that the JSON parses. The #71 bug is exactly a plan that was valid JSON but did not meet the goal.
3. "Unaware of when to stop" and "claimed an edit that was not made" have direct chat analogues (#63, #70): the app, not the model, decides when a plan change is done and confirms it from the database.
