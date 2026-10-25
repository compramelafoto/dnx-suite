import { after, NextResponse } from "next/server";
import { procesarUpdateTelegram } from "@/lib/presupuesto-automatico/telegram-webhook";
import { conexionPorId } from "@/lib/telegram/conexion";
import { ENCABEZADO_SECRETO, leerUpdate, secretoValido } from "@/lib/telegram/webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Aprobar manda el correo y el WhatsApp después de contestarle a Telegram (`after`). */
export const maxDuration = 60;

/**
 * Webhook de Telegram del presupuesto automático (spec 2026-10-25 §3). FOTOFFICE lo registra solo
 * con `setWebhook` al conectar el bot: `https://<FOTOFFICE>/api/webhooks/telegram/<id de la conexión>`.
 *
 * Cada aviso trae `X-Telegram-Bot-Api-Secret-Token` con el secreto que elegimos al registrarlo; se
 * compara contra su hash guardado. Sin conexión o con el secreto mal: 401, sin decir cuál de las dos.
 * Lo verificado se confirma enseguida con 200 y se procesa después (`after`): si Telegram no recibe
 * respuesta, reintenta, y procesar es idempotente igual.
 */
export async function POST(request: Request, { params }: { params: Promise<{ conexionId: string }> }) {
  const { conexionId } = await params;
  const conexion = await conexionPorId(conexionId);
  if (!conexion || !secretoValido(request.headers.get(ENCABEZADO_SECRETO), conexion.webhookSecretHash)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: true, ignored: true });
  }
  const update = leerUpdate(payload);
  if (update.tipo === "OTRO") return NextResponse.json({ ok: true, ignored: true });
  after(() => procesarUpdateTelegram(conexion, update));
  return NextResponse.json({ ok: true });
}
