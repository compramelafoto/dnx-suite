import { loadEnvFiles } from "../../../config/env.js";
import { TelegramApiClient } from "../bot/telegram-api-client.js";
import {
  loadTelegramConfig,
  validateTelegramConfig,
} from "../domain/config.js";

export async function runTelegramSendTest(): Promise<{
  exitCode: number;
  lines: string[];
}> {
  loadEnvFiles();
  const config = loadTelegramConfig();
  const validation = validateTelegramConfig(config);
  const lines = [...validation.lines];

  if (!validation.readyForStart) {
    return { exitCode: 1, lines };
  }

  const chatId = config.allowedChatIds[0]!;
  const client = new TelegramApiClient({ botToken: config.botToken });
  const result = await client.sendMessage({
    chatId,
    text: "DNX telegram:send-test — mensaje de prueba local. Si lo ves, el token y el chat ID están bien.",
  });

  if (!result.ok) {
    lines.push(`Envío fallido: ${result.description}`);
    return { exitCode: 1, lines };
  }

  lines.push(`Mensaje de prueba enviado al chat ${chatId}`);
  return { exitCode: 0, lines };
}
