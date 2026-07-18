import { runTelegramSendTest } from "./run-telegram-send-test.js";

const result = await runTelegramSendTest();
for (const line of result.lines) console.log(line);
process.exit(result.exitCode);
