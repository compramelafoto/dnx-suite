import { readBuyerBotConfig } from "@/lib/bot/comprador/config";
import { historiaDeCaso } from "@/lib/soporte/caso-bot";
import { leerTokenCaso } from "@/lib/soporte/token-caso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?token= — historia del reclamo para abrir la ventana del bot desde el link del mail. */
export async function GET(req: Request) {
  if (!readBuyerBotConfig().enabled) return new Response("No encontrado", { status: 404 });
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const caso = await leerTokenCaso(token);
  if (!caso) return Response.json({ error: "caso_vencido" }, { status: 404 });
  return Response.json(await historiaDeCaso(caso.ticketId));
}
