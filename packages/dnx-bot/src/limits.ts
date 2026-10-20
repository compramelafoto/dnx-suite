export type BotLimits = { maxMessagesPerUserPerDay: number; monthlyCapMicroUsd: number };
export type BotUsageSnapshot = { userMessagesToday: number; monthMicroUsd: number };
export type LimitDecision =
  | { allowed: true }
  | { allowed: false; reason: "user_daily" | "monthly_cap"; message: string };

export function checkLimits(limits: BotLimits, usage: BotUsageSnapshot): LimitDecision {
  if (limits.monthlyCapMicroUsd > 0 && usage.monthMicroUsd >= limits.monthlyCapMicroUsd) {
    return {
      allowed: false,
      reason: "monthly_cap",
      message: "Ahora no puedo responder automáticamente. Tocá «Hablar con una persona» y te respondemos por Soporte.",
    };
  }
  if (usage.userMessagesToday >= limits.maxMessagesPerUserPerDay) {
    return {
      allowed: false,
      reason: "user_daily",
      message: "Llegaste al máximo de mensajes de hoy. Si necesitás ayuda ya, tocá «Hablar con una persona».",
    };
  }
  return { allowed: true };
}
