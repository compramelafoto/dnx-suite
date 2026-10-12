import { habilitacionComprador, headersInvitado, invitadoDe } from "@/lib/bot/comprador/contexto-pedido";
import { saludoComprador } from "@/lib/bot/comprador/saludo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Estado de la burbuja de compradores para `?pagePath=<pathname+search>`. Con el bot apagado no toca
 * la base. Si el navegador no tenía la cookie del invitado, acá nace (en los headers del Response).
 */
export async function GET(req: Request) {
  const hab = await habilitacionComprador(new URL(req.url).searchParams.get("pagePath") ?? undefined);
  if (!hab.habilitado) return Response.json({ enabled: false });
  const inv = invitadoDe(req);
  const s = saludoComprador(hab.pagina);
  return Response.json(
    {
      enabled: true,
      alerta: false,
      saludo: s.saludo,
      sugerencias: s.sugerencias,
      globito: s.globito,
      globitoDemoraMs: s.globitoDemoraMs,
      progresoEscolar: null,
    },
    { headers: headersInvitado(inv) },
  );
}
