# AI session log

Required by the ECE1724 project handout: representative AI interactions, what was asked, what came back, and what the team did with it. Each of us appends our own entries.

## Nabeegh

### 23 October 2026, tooling on the skeleton (issue #1)

**Asked:** how to add Prettier to the Next.js ESLint flat config without the two fighting over formatting, and what a minimal GitHub Actions workflow for a Next.js app looks like.

**Got:** the Next.js ESLint docs recommend `eslint-config-prettier` added last in `extends`; `prettier-plugin-tailwindcss` needs `tailwindStylesheet` pointed at the CSS entry point under Tailwind v4 because there is no `tailwind.config.js`; a workflow with `npm ci` then format check, lint, typecheck and build.

**Did with it:** wrote `prettier.config.mjs`, `.prettierignore`, the `extends` change and the npm scripts myself; ran all four checks locally before committing; verified the `extends` order against the Next.js docs page rather than taking it on trust. The lint run is slow on my machine (WSL on a Windows mount), so CI is the gate.
