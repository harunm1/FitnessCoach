# Coach personas (#80): what the literature says about coaching style, 10 Nov 2026

**Feeds:** #80 (coach personas), #84 (coach memory), final report (related work).
**How read:** full text through the Lune connector's extraction (one structured read per paper, 10 Nov 2026), except where marked abstract only. Lune flagged four of the five reads as truncated, so each needs its results section confirmed before a number goes into the report.

## Papers

1. **Srinivas, Xu, Liu, Ayush, Galatzer-Levy, Patel et al. (2025).** Substance over style: Evaluating proactive conversational coaching agents. _ACL 2025_. https://aclanthology.org/2025.acl-long.1017/ Read: full text (truncated). Directive, interrogative and facilitative coaching agents; user study N = 31, 155 conversations. Question-only styles lowered engagement and satisfaction; good style helped only when the substance (context gathering, relevant recommendation) was there. Users with more chatbot experience picked the directive agent first more often (29.2% vs 0%).
2. **Jörke, Sapkota, Warkenthien, Vainio, Schmiedmayer, Brunskill et al. (2025).** GPTCoach: Towards LLM-based physical activity coaching. _CHI 2025_. Read: full text (truncated); our full note is `2025-jorke-gptcoach.md`. Design principles: facilitative and non-prescriptive, tailored with context, supportive and non-judgmental tone. One formative participant wanted the coach to change persona by the day ("sometimes empathetic, other times the strict regimen").
3. **Hoang, Rogers and Ross (2026).** An LLM-based motivation-aware framework for AI coaching for behaviour change. _CHI 2026_. Read: full text. Motivational support for ambivalent users, planning strategies for action-ready users; users who agreed a change plan with the agent gained the most intrinsic motivation.
4. **Silacci, Cherubini, Boldi, Rapp and Caon (2026).** When workout buddies are virtual: AI agents and human peers in a longitudinal physical activity study. _CHI 2026_. Read: full text (truncated). Randomised, four conditions; AI peers built a stronger task-focused working alliance than human peers, human peers more social presence; avatar type made no difference. Participants differed: some wanted competition, others steady encouragement.
5. **Cox, Wester and van Berkel (2026).** Polite but boring? Trade-offs between engagement and psychological reactance to chatbot feedback styles. _CHI 2026_. Read: full text (truncated). Direct, polite and verbal-leakage feedback each trade reactance against engagement; no single style wins.
6. **Eska, Hensche et al. (2026).** GymBuddy: Embedding motivational theories in conversational AI fitness coaches. _ACM PerDis 2026_. https://doi.org/10.1145/3797993.3798020 Read: abstract only (not in the Lune corpus; PDF to fetch). Four personalities from self-determination theory (autonomy-, competence-, relatedness-supportive, controlling); style changed performance and motivation; N = 14.
7. **Terblanche and Brown (2026).** Rethinking directiveness in AI coaching chatbots. _Frontiers in Psychology_. https://doi.org/10.3389/fpsyg.2026.1822088 Read: abstract only. Directive vs non-directive generative coaches, N = 158 quasi-experiment, workplace coaching; directive rated higher on working alliance and goal attainment; preference varied with personality.
8. **Mitchell, Maimone et al. (2021).** Automated vs. human health coaching. _PACM HCI 5 (CSCW1)_. https://doi.org/10.1145/3449173 Read: abstract and excerpts. A scripted coach that always offered a menu of choices was valued for autonomy; tone carried weight.

## Synthesis for #80

- Substance first: style helps only when the plan and advice are sound (1), which matches #80's rule that a persona changes wording and never the plan, the verifier or the guardrails.
- People differ in the style they want (1, 2, 4, 7), so a user-chosen persona has support; a fixed house style does not fit everyone.
- A directive option is defensible (1, 7); a question-only style lowers engagement (1); a controlling style is the one GymBuddy tested as the negative case (6, abstract only).
- Proposed set, to confirm after GymBuddy's full read: supportive (autonomy-supportive, the default), technical (competence-supportive, explains the why), direct (short, directive). No controlling persona.
- Evaluation: compare personas on the same plans with the coach eval (#64), since style effects only show once substance is fixed (1).
