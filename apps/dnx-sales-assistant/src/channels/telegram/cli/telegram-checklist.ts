import { runTelegramChecklist } from "./run-telegram-checklist.js";

const result = runTelegramChecklist();
for (const line of result.lines) console.log(line);
process.exit(result.exitCode);
