import { loadEnvFiles } from "../../../config/env.js";
import {
  loadOwnerIdentityConfig,
  maskOwnerEmail,
} from "../../../pricing/owner/owner-identity.js";
import { resolveOwnerPricingProfile } from "../../../pricing/owner/resolve-owner-pricing-profile.js";
import { createDefaultPricingRuntimeDeps } from "../../../pricing/runtime/pricing-runtime.js";
import { CalibrationLabApi } from "../../../calibration/lab/calibration-lab-api.js";
import { TelegramApiClient } from "../bot/telegram-api-client.js";
import {
  loadTelegramConfig,
  validateTelegramConfig,
} from "../domain/config.js";
import { LongPollingRunner } from "../polling/long-polling-runner.js";
import { TelegramLocalStore } from "../persistence/telegram-local-store.js";
import { invalidateSyntheticBudgets } from "../session/invalidate-synthetic-budget.js";
import { TelegramChannelHandler } from "../session/telegram-channel-handler.js";

export async function runTelegramStart(): Promise<number> {
  loadEnvFiles();
  const config = loadTelegramConfig();
  const validation = validateTelegramConfig(config);

  for (const line of validation.lines) {
    console.log(line);
  }

  if (!validation.readyForStart || !config.enabled) {
    if (!config.enabled) {
      console.log("Activá DNX_TELEGRAM_ENABLED=true en .env.local");
    }
    return validation.exitCode || 1;
  }

  const localStore = new TelegramLocalStore();
  await localStore.load();

  const invalidation = await invalidateSyntheticBudgets(localStore);
  if (invalidation.conversationsTouched > 0 || invalidation.chatsFlagged > 0) {
    console.log(
      `[telegram] presupuestos sintéticos invalidados: conversaciones=${invalidation.conversationsTouched} chats=${invalidation.chatsFlagged}`,
    );
  }

  const ownerIdentity = loadOwnerIdentityConfig();
  const ownerResolved = resolveOwnerPricingProfile(
    {
      channel: "TELEGRAM",
      telegramUserId: ownerIdentity.telegramOwnerUserId,
      telegramChatId: ownerIdentity.telegramOwnerChatId,
      ownerEmail: ownerIdentity.ownerEmail,
    },
    ownerIdentity,
  );
  console.log(
    `[telegram] pricing profile status=${ownerResolved.status}${
      ownerIdentity.ownerEmail
        ? ` owner=${maskOwnerEmail(ownerIdentity.ownerEmail)}`
        : ""
    }`,
  );

  const client = new TelegramApiClient({ botToken: config.botToken });
  const handler = new TelegramChannelHandler({
    config,
    localStore,
    ownerIdentity,
    pricingRuntime: {
      ...createDefaultPricingRuntimeDeps(),
      silentLogs: true,
    },
    calibration: new CalibrationLabApi(),
  });

  const runner = new LongPollingRunner({
    client,
    handler,
    localStore,
    log: (msg) => console.log(`[telegram] ${msg}`),
  });

  console.log("");
  console.log("DNX Sales Assistant — Telegram privado");
  console.log("");
  console.log("Modo: long polling local");
  console.log("Usuario autorizado: configurado");
  console.log(`Perfil económico: ${ownerResolved.status}`);
  console.log("Estado: escuchando mensajes");
  console.log("");
  console.log("El bot sólo funciona mientras este proceso esté encendido.");
  console.log("Presioná Ctrl+C para detener.");
  console.log("");

  const shutdown = () => {
    console.log("\nCerrando Telegram (polling)…");
    runner.stop();
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await runner.run();
  console.log("Polling detenido. Recursos liberados.");
  return 0;
}
