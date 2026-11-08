import { after, NextResponse } from "next/server";
import { leerCanalAgentes } from "@/lib/agentes/canal";
import { procesarUpdateAgentes } from "@/lib/agentes/webhook-agentes";
import { ENCABEZADO_SECRETO, leerUpdate, secretoValido } from "@/lib/telegram/webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** "Otra noticia" y las correcciones llaman a Claude con búsqueda web después de contestar (`after`). */
export const maxDuration = 300;

/**
 * Webhook del bot de agentes (spec 2026-11-07). Se registra desde Super Admin → Agentes con
 * `setWebhook`: `https://<FOTOFFICE>/api/webhooks/telegram-agentes`. Cada aviso trae
 * `X-Telegram-Bot-Api-Secret-Token`, que se compara contra el hash guardado en `SystemSettings`.
 * Sin canal o con el secreto mal: 401. Lo verificado se confirma enseguida con 200 y se procesa
 * después: si Telegram no recibe respuesta, reintenta.
 */
export async function POST(request: Request) {
  const canal = await leerCanalAgentes();
  if (!canal || !secretoValido(request.headers.get(ENCABEZADO_SECRETO), canal.webhookSecretHash)) {
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
  after(() => procesarUpdateAgentes(canal, update));
  return NextResponse.json({ ok: true });
}
