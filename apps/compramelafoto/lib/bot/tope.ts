import { sendTelegramMessage } from "@repo/dnx-bot";
import { readBotConfig } from "@/lib/bot/config";
import { argentinaMonthPrefix } from "@/lib/bot/dia-argentino";
import { claimOnceMarker, monthCostMicroUsd, releaseOnceMarker } from "@/lib/bot/store";

function usd(microUsd: number, decimals: number): string {
  return (microUsd / 1_000_000).toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: 2 });
}

/** "MM" del mes siguiente al mes argentino `YYYY-MM`. */
function nextMonth(prefix: string): string {
  const m = Number(prefix.slice(5, 7));
  return String((m % 12) + 1).padStart(2, "0");
}

/**
 * Avisa por Telegram cuando el gasto del mes cruza el 80 % y el 100 % del tope.
 * Una sola vez por umbral y por mes entre todas las instancias (ver claimOnceMarker); si Telegram
 * falla, la marca se libera y se reintenta en un turno posterior.
 * Nunca lanza: un problema acá no puede romper la respuesta del bot.
 */
export async function notifyCapThresholds(now: Date = new Date()): Promise<void> {
  try {
    const cfg = readBotConfig();
    const cap = cfg.limits.monthlyCapMicroUsd;
    // Sin Telegram no se reserva nada: cuando se configure, el aviso pendiente sale en el próximo turno.
    if (cap <= 0 || !cfg.telegram) return;
    const spent = await monthCostMicroUsd(now);
    const month = argentinaMonthPrefix(now);
    const avisos: { pct: number; text: string }[] = [
      {
        pct: 80,
        text: `⚠️ DNX Bot llegó al 80 % del tope mensual: USD ${usd(spent, 2)} de USD ${usd(cap, 0)} (se factura en dólares).`,
      },
      {
        pct: 100,
        text: `🛑 DNX Bot llegó al tope mensual: deja de responder con IA hasta el 1/${nextMonth(month)}; los fotógrafos ven la opción de abrir un ticket.`,
      },
    ];
    for (const a of avisos) {
      if (spent * 100 < cap * a.pct) continue;
      const signature = `cap-${a.pct}-${month}`;
      const mine = await claimOnceMarker({
        signature,
        title: `Aviso de tope mensual ${a.pct} % (${month})`,
        data: { spentMicroUsd: spent, capMicroUsd: cap },
      });
      if (!mine) continue;
      const r = await sendTelegramMessage(cfg.telegram, a.text).catch((e: unknown) => ({ ok: false, error: String(e) }));
      if (!r.ok) {
        // Se libera la marca: un turno posterior lo vuelve a intentar en vez de perder el aviso del mes.
        console.error("[dnx-bot] aviso de tope sin enviar", a.pct, r.error);
        await releaseOnceMarker(signature);
      }
    }
  } catch (e) {
    console.error("[dnx-bot] aviso de tope", e);
  }
}
