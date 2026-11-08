# Akrimi, Schwensfeier, Düking, Kreutz and Brinkmann (2025), ChatGPT-4o exercise plans for type 2 diabetes

**Citation.** Akrimi, S., Schwensfeier, L., Düking, P., Kreutz, T., and Brinkmann, C. (2025). ChatGPT-4o-generated exercise plans for patients with type 2 diabetes mellitus: Assessment of their safety and other quality criteria by coaching experts. _Sports_, 13(4), 92. https://doi.org/10.3390/sports13040092 (open access, PMC12031090).
**Read:** the full article on PMC including all tables and references (the supplementary zip of generated plans was not opened), 8 Nov 2026.
**Feeds:** #48 (check-up note when a condition is listed), quiz screening item for meeting 4.

## What they did

- A discussion paper on preliminary data: three fictional patients with type 2 diabetes (35 F, BMI 28, metformin; 51 F, BMI 45, grade 1 hypertension, ramipril; 65 M, BMI 31, proliferative retinopathy, diabetic foot risk, insulin), three prompts (basic; detailed with ADA/ACSM, contraindications, FITT; and a version ChatGPT optimised itself), so nine 12-week plans, generated 16 Sept 2024 with free ChatGPT-4o.
- Three expert raters from the research team rated each plan low, moderate or strong on three safety criteria and eight training criteria drawn from ADA and ACSM; ICC 0.763.

## Results

- **The most common safety gap: no advice to get a medical check-up before starting** where the guidelines call for one (over 40, complications, high-intensity plans, sedentary, or long diabetes duration). Rated low in 8 of 9 plans; only plan 4 rated strong.
- High-intensity training was recommended to the patient with proliferative retinopathy (risk of vitreous haemorrhage or retinal detachment).
- Missing safety instructions: glucose monitoring around exercise for insulin users; not holding the breath during strength work with hypertension.
- No balance work for the older patient, against ADA guidance; intensity often unspecified (no target heart rate, no guidance on training to failure); sample exercises only; total time not matching the stated volume; complex body-weight moves unsuitable for beginners.
- Personal preference and starting fitness were always respected. More detailed prompts helped a little; the self-optimised prompt did not beat the detailed one.
- Authors' conclusion: not yet safe for this group, especially with complications; involve a professional coach before starting.

## Limits they state

Three fictional patients; raters were authors (possible bias, not blinded to prompt); one model version; one date.

## What it means for FitnessCoach

1. **#48:** when the profile lists an injury or condition, the coach must add a one-line check-up note and must not schedule high-intensity work; enforce in code, not in the prompt.
2. Intensity must be explicit (RPE per exercise, #65), and total session time must match the sets, reps and rest; `verify` can compute and check this.
3. Older or less-fit profiles should get balance work; a rule-based component check (as in FITTER) covers it.
4. Pre-participation screening (a PAR-Q+ style question in the onboarding quiz) is Mohammad's area; raise at the next team meeting rather than as an issue.
