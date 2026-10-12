/** Telegram lento no puede colgar a quien avisa. */
export const TELEGRAM_TIMEOUT_MS = 5_000;

export async function sendTelegramMessage(
  cfg: { token: string; chatId: string } | null,
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; error?: string }> {
  if (!cfg) return { ok: false, error: "sin_configuracion" };
  try {
    const res = await fetchImpl(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: cfg.chatId, text: text.slice(0, 4000), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, error: `http_${res.status}` };
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) return { ok: false, error: "timeout" };
    // El mensaje de error de fetch puede incluir la URL, que lleva el token del bot: se tapa.
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: cfg.token ? msg.replaceAll(cfg.token, "***") : msg };
  }
}
