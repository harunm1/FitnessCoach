// ESLint flat config for Next.js 16 (eslint-config-next is native flat config from v16,
// so the FlatCompat wrapper we had on 15 is gone). Shape follows the Next.js ESLint
// docs, "With Prettier": Prettier's config goes after the Next.js rules so it can switch
// off any formatting rule they turn on; Prettier itself owns formatting.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**", // Prisma Client, regenerated on install
  ]),
]);

export default eslintConfig;
