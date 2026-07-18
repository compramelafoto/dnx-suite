import { runTelegramValidate } from "./run-telegram-validate.js";

const result = runTelegramValidate();
for (const line of result.lines) console.log(line);
process.exit(result.exitCode);
