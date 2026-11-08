# Jiang & Fowler (2026): open-source and proprietary LLMs for Explain-in-Plain-English grading

## Citation

Jiang, E., & Fowler, M. (2026). You Don't Need a Data Center to Explain in Plain English! Comparing Open-Source and Proprietary LLMs for EiPE Grading. _Proceedings of the 57th ACM Technical Symposium on Computer Science Education V.1 (SIGCSE TS 2026)_. https://doi.org/10.1145/3770762.3772560 (CC BY 4.0)

## Read

Read in full (all 7 pages) by Nabeegh for CAIRO on 18 October 2026; full notes in `code-comprehension-agent/Papers/eipe-grading/notes/06-you-don-t-need-a-data-center-to-explain-in-plain-english-com.md`. Summary below from those notes.

## Feeds

#22 (model choice for structured judgements), #7.

## What they did

Few-shot grading (yes/no correct) of 620 student explanations across 17 Explain-in-Plain-English questions from an intro Python course, against instructor labels; open models from 7B to 72B (Llama, Qwen, DeepSeek R1 variants, via a serverless provider) against OpenAI models.

## Results

- o4-mini most accurate at 87.3%. Llama 3.1 70B, Llama 3.3 70B and Qwen 2.5 72B reached about 86%; Llama 3.1 70B was not significantly different from o4-mini and beat GPT-4o. Qwen 3 32B reached 83.5%.
- Smaller and non-instruct models broke the one-word answer format most often; all OpenAI models followed it.
- Hosting a 70B model needs about 140 GB of memory (six to eight A10 GPUs, about $16 an hour on AWS); an 8B model fits one 24 GB GPU.

## Limits

One course and one grader's labels; latency not measured; random few-shot examples; no GPT-5 or code models tested.

## What it means for FitnessCoach

#22's summary is accurate. The transferable point is format compliance: smaller models break a strict output format more often, which is why our coach validates every reply against a schema in code. Groq no longer serves Llama, so the model result itself does not carry over (#19).
