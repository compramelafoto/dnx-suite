import { readBuyerBotConfig } from "@/lib/bot/comprador/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Los compradores no tienen cuenta: el «una vez por visita» del globito lo maneja el navegador. No guarda nada. */
export async function POST() {
  if (!readBuyerBotConfig().enabled) return Response.json({ error: "No encontrado" }, { status: 404 });
  return Response.json({ ok: true });
}
