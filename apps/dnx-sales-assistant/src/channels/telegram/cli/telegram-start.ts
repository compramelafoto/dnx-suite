import { runTelegramStart } from "./run-telegram-start.js";

const code = await runTelegramStart();
process.exit(code);
