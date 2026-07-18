import { maskTelegramToken } from "../domain/config.js";

/** Log seguro: nunca imprime token ni montos. */
export function safeTelegramLog(message: string, meta?: Record<string, unknown>): void {
  const blob = JSON.stringify(meta ?? {});
  if (/recommendedBusiness|minimumSustainable|breakdown/i.test(blob + message)) {
    console.log(`[telegram] ${message}`);
    return;
  }
  if (meta?.token && typeof meta.token === "string") {
    console.log(`[telegram] ${message}`, {
      ...meta,
      token: maskTelegramToken(meta.token),
    });
    return;
  }
  console.log(`[telegram] ${message}`, meta ?? "");
}
