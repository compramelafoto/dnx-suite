import { runTelegramStatus } from "./run-telegram-status.js";

const result = await runTelegramStatus();
for (const line of result.lines) console.log(line);
process.exit(result.exitCode);
