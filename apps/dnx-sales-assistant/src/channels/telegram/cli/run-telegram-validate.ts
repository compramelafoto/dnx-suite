import { loadEnvFiles } from "../../../config/env.js";
import {
  loadOwnerIdentityConfig,
  maskOwnerEmail,
} from "../../../pricing/owner/owner-identity.js";
import { resolveOwnerPricingProfile } from "../../../pricing/owner/resolve-owner-pricing-profile.js";
import {
  loadTelegramConfig,
  validateTelegramConfig,
} from "../domain/config.js";

export function runTelegramValidate(): {
  exitCode: number;
  lines: string[];
} {
  loadEnvFiles();
  const config = loadTelegramConfig();
  const result = validateTelegramConfig(config);
  const lines = [...result.lines];

  const identity = loadOwnerIdentityConfig();
  lines.push("");
  lines.push("Identidad económica del propietario:");
  lines.push(
    `  DNX_OWNER_EMAIL: ${identity.ownerEmail ? maskOwnerEmail(identity.ownerEmail) : "FALTA"}`,
  );
  lines.push(
    `  DNX_TELEGRAM_OWNER_USER_ID: ${identity.telegramOwnerUserId || "FALTA"}`,
  );
  lines.push(
    `  DNX_TELEGRAM_OWNER_CHAT_ID: ${identity.telegramOwnerChatId || "FALTA"}`,
  );

  const identityOk =
    Boolean(identity.ownerEmail) &&
    Boolean(identity.telegramOwnerUserId) &&
    Boolean(identity.telegramOwnerChatId);

  if (!identityOk) {
    lines.push(
      "  Estado: identidad incompleta (Telegram puede autorizar el chat, pero no hay perfil económico resoluble).",
    );
    lines.push(
      "  La autorización para utilizar el bot de Telegram no determina por sí sola qué perfil económico debe utilizar Cuánto Cobro.",
    );
    return {
      exitCode: Math.max(result.exitCode, 1),
      lines,
    };
  }

  const resolved = resolveOwnerPricingProfile(
    {
      channel: "TELEGRAM",
      telegramUserId: identity.telegramOwnerUserId,
      telegramChatId: identity.telegramOwnerChatId,
      ownerEmail: identity.ownerEmail,
    },
    identity,
  );
  lines.push(`  pricing profile status=${resolved.status}`);
  if (resolved.status !== "READY") {
    lines.push(
      "  Nota: /presupuesto bloqueará el cálculo hasta configurar un perfil .local real (sin sintéticos).",
    );
  }

  return { exitCode: result.exitCode, lines };
}
