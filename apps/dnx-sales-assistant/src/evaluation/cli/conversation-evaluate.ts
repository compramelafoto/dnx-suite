import { runConversationEvaluate } from "./run-conversation-evaluate.js";

function parseArgs(argv: string[]): {
  scenarioId?: string;
  json?: boolean;
  verbose?: boolean;
  mode: "all" | "scenario" | "report";
} {
  let scenarioId: string | undefined;
  let json = false;
  let verbose = false;
  let mode: "all" | "scenario" | "report" = "all";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === "--json") json = true;
    else if (arg === "--verbose" || arg === "-v") verbose = true;
    else if (arg === "--scenario" && argv[i + 1]) {
      mode = "scenario";
      scenarioId = argv[++i];
    } else if (arg === "all") mode = "all";
    else if (arg === "report") {
      mode = "report";
      verbose = true;
    } else if (!arg.startsWith("-") && !scenarioId && mode !== "report") {
      // positional scenario id: conversation:evaluate:scenario <id>
      mode = "scenario";
      scenarioId = arg;
    }
  }

  return { scenarioId, json, verbose, mode };
}

const parsed = parseArgs(process.argv.slice(2));
const result = await runConversationEvaluate({
  scenarioId: parsed.mode === "scenario" ? parsed.scenarioId : undefined,
  json: parsed.json,
  verbose: parsed.verbose || parsed.mode === "report",
});

for (const line of result.lines) {
  console.log(line);
}
process.exit(result.exitCode);
