/**
 * Configuración de DNX Bot en FOTOFFICE (variables `FOTOFFICE_BOT_*`, spec §11) y la convención de
 * `platform` de las tablas `Bot*` (spec §7): `"FOTOFFICE:<workspaceId>"` para todo lo de un workspace
 * y `"FOTOFFICE"` para las marcas globales. Las métricas de todo FOTOFFICE usan `startsWith(PREFIJO)`.
 * Sin base ni sesión: se puede leer en cualquier lado.
 */

export const PLATAFORMA_GLOBAL = "FOTOFFICE";
export const PREFIJO_PLATAFORMA = `${PLATAFORMA_GLOBAL}:`;
/** Fila de piloto en `WorkspaceFeatureModule`. A propósito NO está en `lib/modules/registry.ts`. */
export const MODULO_DNX_BOT = "dnx-bot";

export type LimitesFotoffice = {
  maxMessagesPerUserPerDay: number;
  /** Todo FOTOFFICE. 0 = sin tope. */
  monthlyCapMicroUsd: number;
  /** Cada workspace. 0 = sin tope. */
  workspaceMonthlyCapMicroUsd: number;
};

export type BotConfigFotoffice = {
  enabled: boolean;
  model: string;
  effort: "low" | "medium" | "high";
  maxIterations: number;
  limits: LimitesFotoffice;
  telegram: { token: string; chatId: string } | null;
  anthropicApiKey: string | null;
};

function enteroPositivo(v: string | undefined, def: number): number {
  const n = Number(v?.trim());
  return v?.trim() && Number.isInteger(n) && n >= 1 ? n : def;
}

function noNegativo(v: string | undefined, def: number): number {
  const n = Number(v?.trim());
  return v?.trim() && Number.isFinite(n) && n >= 0 ? n : def;
}

const microUsd = (usd: number) => Math.round(usd * 1_000_000);

export function leerConfigBot(env: NodeJS.ProcessEnv = process.env): BotConfigFotoffice {
  const effort = env.FOTOFFICE_BOT_EFFORT?.trim();
  const token = env.FOTOFFICE_BOT_TELEGRAM_TOKEN?.trim();
  const chatId = env.FOTOFFICE_BOT_TELEGRAM_CHAT_ID?.trim();
  return {
    enabled: env.FOTOFFICE_BOT_ENABLED?.trim() === "1",
    model: env.FOTOFFICE_BOT_MODEL?.trim() || "claude-sonnet-5-5",
    effort: effort === "low" || effort === "high" ? effort : "medium",
    maxIterations: enteroPositivo(env.FOTOFFICE_BOT_MAX_ITERATIONS, 8),
    limits: {
      maxMessagesPerUserPerDay: enteroPositivo(env.FOTOFFICE_BOT_MAX_MESSAGES_PER_DAY, 60),
      monthlyCapMicroUsd: microUsd(noNegativo(env.FOTOFFICE_BOT_MONTHLY_CAP_USD, 15)),
      workspaceMonthlyCapMicroUsd: microUsd(noNegativo(env.FOTOFFICE_BOT_WORKSPACE_MONTHLY_CAP_USD, 10)),
    },
    telegram: token && chatId ? { token, chatId } : null,
    anthropicApiKey: env.ANTHROPIC_API_KEY?.trim() || null,
  };
}

export function plataformaDe(workspaceId: string): string {
  if (!workspaceId.trim()) throw new Error("Falta el workspace de la plataforma del bot");
  return `${PREFIJO_PLATAFORMA}${workspaceId}`;
}

export function workspaceDePlataforma(plataforma: string): string | null {
  if (!plataforma.startsWith(PREFIJO_PLATAFORMA)) return null;
  const id = plataforma.slice(PREFIJO_PLATAFORMA.length);
  return id ? id : null;
}
