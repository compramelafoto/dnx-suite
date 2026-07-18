import { runTelegramPair } from "./run-telegram-pair.js";

const result = await runTelegramPair();
for (const line of result.lines) console.log(line);
process.exit(result.exitCode);
