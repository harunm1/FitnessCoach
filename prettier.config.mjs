// Prettier owns formatting; ESLint owns code quality. eslint-config-prettier
// (in eslint.config.mjs) turns off the ESLint rules that would fight this file.
// The Tailwind plugin sorts class names into Tailwind's recommended order, so
// className diffs stay small when four of us edit the same component.

/** @type {import("prettier").Config} */
const config = {
  plugins: ["prettier-plugin-tailwindcss"],
  // Tailwind v4 has no tailwind.config.js, so the plugin reads the theme from our CSS entry point.
  tailwindStylesheet: "./src/app/globals.css",
};

export default config;
