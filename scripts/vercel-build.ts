// Vercel build command (vercel.json): runs the steps from buildSteps, stopping at the first failure.
import { execSync } from "node:child_process";
import { buildSteps } from "../src/lib/deploy/release";

for (const step of buildSteps(process.env)) {
  console.log(`> ${step}`);
  execSync(`npx --no-install ${step}`, { stdio: "inherit" });
}
