// Command-line arguments of eval/coachEval.ts: mode, label, profile list and the repeat flags.
export type EvalArgs = {
  mode: string;
  label: string;
  only?: string[];
  repeat?: number;
  file?: string;
};

const FLAGS = ["--repeat", "--file"];

export function parseArgs(argv: string[]): EvalArgs {
  const positionals: string[] = [];
  const flags = new Map<string, string | undefined>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.includes("=") && FLAGS.includes(arg.split("=")[0])) {
      const [name, value] = arg.split("=");
      throw new Error(`write ${name} ${value}, not ${arg}`);
    }
    if (FLAGS.includes(arg)) {
      const value = argv[++i];
      if (arg === "--file" && (value === undefined || value.startsWith("--"))) {
        throw new Error(
          "--file needs a path, such as --file results/run.jsonl",
        );
      }
      flags.set(arg, value);
    } else positionals.push(arg);
  }
  const [mode = "groq", label = "run", only] = positionals;
  const args: EvalArgs = { mode, label };
  if (only) args.only = only.split(",");
  if (flags.has("--repeat")) {
    const repeat = Number(flags.get("--repeat"));
    if (!Number.isInteger(repeat) || repeat < 1) {
      throw new Error(
        "--repeat needs a whole number of runs, such as --repeat 5",
      );
    }
    args.repeat = repeat;
  }
  const file = flags.get("--file");
  if (file) args.file = file;
  return args;
}
