import { resolverBot } from "@/lib/dnx-bot/acceso";
import { PANTALLAS, pantallaDeRuta, type Pantalla } from "@/lib/dnx-bot/contexto";
import { saludoPara } from "@/lib/dnx-bot/saludo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pantallaDelPedido(req: Request): Pantalla {
  const pedida = new URL(req.url).searchParams.get("pantalla");
  if ((PANTALLAS as readonly string[]).includes(pedida ?? "")) return pedida as Pantalla;
  const referer = req.headers.get("referer");
  try {
    return pantallaDeRuta(referer ? new URL(referer).pathname : null);
  } catch {
    return "otra";
  }
}

/**
 * ¿Hay bot para esta persona en este workspace? La burbuja lo pregunta al cargar el panel.
 * Con cualquier puerta cerrada (o si algo falla) responde `{ enabled: false }` y la burbuja no se
 * pinta: nunca un error a la persona.
 */
export async function GET(req: Request) {
  try {
    const r = await resolverBot();
    if (!r.ok) return Response.json({ enabled: false });
    return Response.json({ enabled: true, ...saludoPara(pantallaDelPedido(req), r.ctx.capacidades) });
  } catch (e) {
    console.error("[dnx-bot] estado", e);
    return Response.json({ enabled: false });
  }
}
