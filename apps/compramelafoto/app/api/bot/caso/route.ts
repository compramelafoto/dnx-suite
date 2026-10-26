import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { historiaDeCaso } from "@/lib/soporte/caso-bot";
import { leerTokenCaso } from "@/lib/soporte/token-caso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?token= — historia del reclamo de un fotógrafo. Exige sesión de la cuenta dueña del ticket. */
export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return new Response("No autenticado", { status: 401 });
  const caso = await leerTokenCaso(new URL(req.url).searchParams.get("token") ?? "");
  if (!caso) return Response.json({ error: "caso_vencido" }, { status: 404 });
  const ticket = await prisma.supportTicket.findUnique({ where: { id: caso.ticketId }, select: { requesterEmail: true } });
  if (ticket?.requesterEmail?.toLowerCase() !== user.email.toLowerCase()) return new Response("No autorizado", { status: 403 });
  return Response.json(await historiaDeCaso(caso.ticketId));
}
