import { runTelegramExportLocal } from "./run-telegram-export-import.js";

const result = await runTelegramExportLocal();
for (const line of result.lines) console.log(line);
process.exit(result.exitCode);
