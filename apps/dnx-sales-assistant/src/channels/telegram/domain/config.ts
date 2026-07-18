import { z } from "zod";

const csvIds = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? "")
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );

export const telegramEnvSchema = z.object({
  DNX_TELEGRAM_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  DNX_TELEGRAM_BOT_TOKEN: z.string().optional().default(""),
  DNX_TELEGRAM_ALLOWED_USER_IDS: csvIds,
  DNX_TELEGRAM_ALLOWED_CHAT_IDS: csvIds,
  DNX_TELEGRAM_TRANSPORT: z
    .enum(["polling", "webhook"])
    .optional()
    .default("polling"),
});

export type TelegramRuntimeConfig = {
  enabled: boolean;
  botToken: string;
  allowedUserIds: string[];
  allowedChatIds: string[];
  transport: "polling" | "webhook";
};

export function loadTelegramConfig(
  env: NodeJS.ProcessEnv = process.env,
): TelegramRuntimeConfig {
  const parsed = telegramEnvSchema.parse({
    DNX_TELEGRAM_ENABLED: env.DNX_TELEGRAM_ENABLED,
    DNX_TELEGRAM_BOT_TOKEN: env.DNX_TELEGRAM_BOT_TOKEN,
    DNX_TELEGRAM_ALLOWED_USER_IDS: env.DNX_TELEGRAM_ALLOWED_USER_IDS,
    DNX_TELEGRAM_ALLOWED_CHAT_IDS: env.DNX_TELEGRAM_ALLOWED_CHAT_IDS,
    DNX_TELEGRAM_TRANSPORT: env.DNX_TELEGRAM_TRANSPORT ?? "polling",
  });

  return {
    enabled: parsed.DNX_TELEGRAM_ENABLED,
    botToken: parsed.DNX_TELEGRAM_BOT_TOKEN.trim(),
    allowedUserIds: parsed.DNX_TELEGRAM_ALLOWED_USER_IDS,
    allowedChatIds: parsed.DNX_TELEGRAM_ALLOWED_CHAT_IDS,
    transport: parsed.DNX_TELEGRAM_TRANSPORT,
  };
}

export type TelegramConfigValidation = {
  ok: boolean;
  exitCode: number;
  lines: string[];
  readyForStart: boolean;
};

export function validateTelegramConfig(
  config: TelegramRuntimeConfig,
): TelegramConfigValidation {
  const lines = ["DNX telegram:validate"];

  if (!config.enabled) {
    lines.push("DNX_TELEGRAM_ENABLED: false");
  } else {
    lines.push("DNX_TELEGRAM_ENABLED: true");
  }

  if (!config.botToken) {
    lines.push("Telegram credentials not configured.");
    lines.push("Falta DNX_TELEGRAM_BOT_TOKEN (usar .env.local, nunca Git).");
    return { ok: false, exitCode: 1, lines, readyForStart: false };
  }

  lines.push("DNX_TELEGRAM_BOT_TOKEN: configurado (no se imprime)");
  lines.push(`DNX_TELEGRAM_TRANSPORT: ${config.transport}`);

  if (config.transport !== "polling") {
    lines.push("ERROR: esta etapa solo admite DNX_TELEGRAM_TRANSPORT=polling");
    return { ok: false, exitCode: 1, lines, readyForStart: false };
  }

  const users = config.allowedUserIds.length;
  const chats = config.allowedChatIds.length;
  lines.push(`Usuarios permitidos: ${users}`);
  lines.push(`Chats permitidos: ${chats}`);

  if (users === 0 || chats === 0) {
    lines.push(
      "Allowlist incompleta. Ejecutá telegram:pair y configurá USER_IDS + CHAT_IDS.",
    );
    return { ok: false, exitCode: 1, lines, readyForStart: false };
  }

  lines.push("Configuración lista para telegram:start");
  return { ok: true, exitCode: 0, lines, readyForStart: true };
}

/** Enmascara token para logs (nunca completo). */
export function maskTelegramToken(token: string): string {
  if (!token) return "(vacío)";
  if (token.length < 10) return "***";
  return `${token.slice(0, 4)}…${token.slice(-3)}`;
}
