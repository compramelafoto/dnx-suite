import type { BotLimits } from "@repo/dnx-bot";
import { prisma } from "@/lib/prisma";

export const BOT_PLATFORM = "CLF";
export const PILOT_SETTINGS_KEY = "dnx_bot_pilot";

export type BotConfig = {
  enabled: boolean;
  model: string;
  effort: "low" | "medium" | "high";
  maxIterations: number;
  limits: BotLimits;
  telegram: { token: string; chatId: string } | null;
  anthropicApiKey: string | null;
};

function posInt(v: string | undefined, def: number): number {
  const n = Number(v?.trim());
  return Number.isInteger(n) && n >= 1 ? n : def;
}

function num(v: string | undefined, def: number): number {
  const n = Number(v?.trim());
  return Number.isFinite(n) && n >= 0 ? n : def;
}

export function readBotConfig(): BotConfig {
  const effort = process.env.CLF_BOT_EFFORT?.trim();
  const token = process.env.CLF_BOT_TELEGRAM_TOKEN?.trim();
  const chatId = process.env.CLF_BOT_TELEGRAM_CHAT_ID?.trim();
  return {
    enabled: process.env.CLF_BOT_ENABLED?.trim() === "1",
    model: process.env.CLF_BOT_MODEL?.trim() || "claude-sonnet-5-5",
    effort: effort === "low" || effort === "high" ? effort : "medium",
    maxIterations: posInt(process.env.CLF_BOT_MAX_ITERATIONS, 8),
    limits: {
      maxMessagesPerUserPerDay: posInt(process.env.CLF_BOT_MAX_MESSAGES_PER_DAY, 50),
      monthlyCapMicroUsd: Math.round(num(process.env.CLF_BOT_MONTHLY_CAP_USD, 30) * 1_000_000),
    },
    telegram: token && chatId ? { token, chatId } : null,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() || null,
  };
}

export async function isBotEnabledForUser(userId: number): Promise<boolean> {
  if (!readBotConfig().enabled) return false;
  let row;
  try {
    row = await prisma.systemSettings.findUnique({ where: { key: PILOT_SETTINGS_KEY } });
  } catch (e) {
    console.error("[bot] no se pudo leer el modo piloto; bot apagado", e);
    return false;
  }
  if (!row || !row.isActive) return false;
  try {
    const p = JSON.parse(row.value) as { soloPiloto?: boolean; userIds?: number[] };
    if (p.soloPiloto === false) return true;
    return Array.isArray(p.userIds) && p.userIds.includes(userId);
  } catch {
    return false;
  }
}
