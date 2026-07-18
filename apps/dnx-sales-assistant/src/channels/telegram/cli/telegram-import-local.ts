import { runTelegramImportLocal } from "./run-telegram-export-import.js";

const file = process.argv[2];
if (!file) {
  console.error("Uso: telegram:import-local <archivo .local>");
  process.exit(1);
}
const result = await runTelegramImportLocal(file);
for (const line of result.lines) console.log(line);
process.exit(result.exitCode);
