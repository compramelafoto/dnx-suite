import { loadEnvFiles } from "../../../config/env.js";
import { TelegramApiClient } from "../bot/telegram-api-client.js";
import { loadTelegramConfig, maskTelegramToken } from "../domain/config.js";
import { mapTelegramUpdate } from "../mapping/map-update.js";

const PAIR_TTL_MS = 5 * 60 * 1000;

/**
 * Modo vinculación: muestra user/chat ID localmente. No autoriza ni guarda.
 */
export async function runTelegramPair(options?: {
  maxMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<{ exitCode: number; lines: string[] }> {
  loadEnvFiles();
  const config = loadTelegramConfig();
  const lines: string[] = [
    "DNX telegram:pair — vinculación temporal",
    "No muestra precios ni procesa cotizaciones.",
  ];

  if (!config.botToken) {
    lines.push("Telegram credentials not configured.");
    lines.push("Definí DNX_TELEGRAM_BOT_TOKEN en .env.local");
    return { exitCode: 1, lines };
  }

  lines.push(`Token: ${maskTelegramToken(config.botToken)} (enmascarado)`);
  lines.push("Escribí /vincular al bot desde un chat privado.");
  lines.push(`Expira en ${Math.round((options?.maxMs ?? PAIR_TTL_MS) / 1000)}s.`);
  lines.push("Ctrl+C para cancelar.");

  const client = new TelegramApiClient({
    botToken: config.botToken,
    fetchImpl: options?.fetchImpl,
  });

  const me = await client.getMe();
  if (!me.ok) {
    lines.push(`No pude contactar Bot API: ${me.description}`);
    return { exitCode: 1, lines };
  }
  lines.push(`Bot: @${me.result.username ?? me.result.id}`);

  const started = Date.now();
  let offset = 0;
  let found = false;

  while (Date.now() - started < (options?.maxMs ?? PAIR_TTL_MS) && !found) {
    const updates = await client.getUpdates({ offset, timeout: 10 });
    if (!updates.ok) {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    for (const update of updates.result) {
      offset = update.update_id + 1;
      const inbound = mapTelegramUpdate(update);
      if (!inbound) continue;
      const text = inbound.text.toLowerCase();
      if (text !== "/vincular" && text !== "/vincular@pair") continue;
      if (inbound.chatType !== "private") {
        lines.push("Ignorado: el chat no es privado.");
        continue;
      }
      found = true;
      lines.push("");
      lines.push("Vinculación detectada (NO autorizada automáticamente):");
      lines.push(`  USER ID: ${inbound.userId}`);
      lines.push(`  CHAT ID: ${inbound.chatId}`);
      if (inbound.username) {
        lines.push(`  username (solo informativo): @${inbound.username}`);
      }
      lines.push("");
      lines.push("Agregá a .env.local:");
      lines.push(`DNX_TELEGRAM_ENABLED=true`);
      lines.push(`DNX_TELEGRAM_TRANSPORT=polling`);
      lines.push(`DNX_TELEGRAM_ALLOWED_USER_IDS=${inbound.userId}`);
      lines.push(`DNX_TELEGRAM_ALLOWED_CHAT_IDS=${inbound.chatId}`);
      lines.push("");
      lines.push("Luego: pnpm --filter dnx-sales-assistant telegram:validate");
      await client.sendMessage({
        chatId: inbound.chatId,
        text: "Recibí /vincular. Completá las variables en la computadora y ejecutá telegram:validate. No activé el acceso automáticamente.",
      });
    }
  }

  if (!found) {
    lines.push("No se recibió /vincular a tiempo. Volvé a ejecutar telegram:pair.");
    return { exitCode: 1, lines };
  }

  return { exitCode: 0, lines };
}
