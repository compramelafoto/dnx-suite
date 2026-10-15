import type { NextRequest } from "next/server";
import { sendTelegramMessage } from "@repo/dnx-bot";
import { decidirEnvio, type TipoComparativa } from "@/lib/bot/comparativa/periodos";
import { buildComparativa } from "@/lib/bot/comparativa/reporte";
import { readBotConfig } from "@/lib/bot/config";
import { assertCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TIPOS: readonly TipoComparativa[] = ["fin_de_semana", "mensual"];

/**
 * Comparativa "costo del bot vs ventas" para Telegram. Corre todos los días a las 13:00 UTC (10:00 en
 * Argentina) pero sólo manda el 18/10/2026 (`PRIMERA_COMPARATIVA`) y el día 1 de cada mes; el resto de
 * los días devuelve `skipped`. `?forzar=1` (con la misma autorización del cron) manda en el momento para
 * probar; `&tipo=mensual|fin_de_semana` elige cuál.
 */
export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;
  // Con el bot apagado no se manda nada.
  const config = readBotConfig();
  if (!config.enabled) return Response.json({ ok: true, skipped: true });
  const params = new URL(req.url).searchParams;
  const pedido = params.get("tipo");
  const tipo = decidirEnvio(new Date(), {
    forzar: params.get("forzar") === "1",
    tipo: TIPOS.find((t) => t === pedido),
  });
  if (!tipo) return Response.json({ ok: true, skipped: true });
  const text = await buildComparativa(tipo, new Date());
  const sent = await sendTelegramMessage(config.telegram, text);
  return Response.json({ ok: true, tipo, telegram: sent });
}
