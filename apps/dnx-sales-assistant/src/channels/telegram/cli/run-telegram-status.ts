import { loadEnvFiles } from "../../../config/env.js";
import {
  loadTelegramConfig,
  validateTelegramConfig,
} from "../domain/config.js";
import { TelegramLocalStore } from "../persistence/telegram-local-store.js";

export async function runTelegramStatus(): Promise<{
  exitCode: number;
  lines: string[];
}> {
  loadEnvFiles();
  const config = loadTelegramConfig();
  const validation = validateTelegramConfig(config);
  const store = new TelegramLocalStore();
  await store.load();

  const lines = [
    "DNX telegram:status",
    `Enabled: ${config.enabled}`,
    `Transport: ${config.transport}`,
    `Token: ${config.botToken ? "configurado" : "ausente"}`,
    `Allowlist users: ${config.allowedUserIds.length}`,
    `Allowlist chats: ${config.allowedChatIds.length}`,
    `Last update_id: ${store.getLastUpdateId()}`,
    `Ready for start: ${validation.readyForStart}`,
    "",
    "Webhook: no configurado (esta etapa usa solo polling).",
    "Puerto 8799: no requerido por Telegram.",
  ];
  return { exitCode: 0, lines };
}
