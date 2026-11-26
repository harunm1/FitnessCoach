# Exercise guidance sources

Where the form guidance stored by the seed comes from (#193, D45). Checked 26 Nov 2026.

- **Curated cues and common mistakes** (30 exercises): `exercise-cues.json`, sources in `exercise-cue-sources.md`.
- **Every other exercise:** the `instructions` of the free-exercise-db record, stored unchanged as cues. Dataset: `dist/exercises.json` at commit `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5` (27 Sep 2026), licence Unlicense (public domain), read from the GitHub API on 26 Nov 2026. The seed downloads exactly that commit. `exercise-instructions-snapshot.json` is a copy of the instructions of 113 of its rows, kept for the tests.
- **Our own text, no outside source:** the dataset ships no instructions for five rows (`Iron_Cross`, `One-Arm_Kettlebell_Swings`, `Push_Press`, `Side_Bridge`, `Side_Jackknife`). Their short neutral cues in `exercise-guidance-fallback.json` are written by us, not taken from a source, and are used only while the dataset has no instructions for the row. `Iron_Cross` says only that no instructions are published, to start light and to stop if form breaks.
