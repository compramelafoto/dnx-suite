import "server-only";
import { prisma } from "@repo/db";
import type { ParsedWebhookEvent } from "@/lib/mailing/webhook-events";

/**
 * Avisos de Resend sobre los correos registrados en `FotofficeMessage` (los de las plantillas:
 * seguimientos de cotización, respuestas automáticas, envíos desde la ficha). Se anota la primera
 * entrega y la primera apertura; un clic también cuenta como apertura. El resto (rebote, queja) no
 * se anota acá. El webhook es compartido: sólo llegan los avisos que ninguna campaña reconoció.
 */
export async function aplicarAvisoMensaje(e: ParsedWebhookEvent): Promise<"APLICADO" | "DUPLICADO" | "DESCONOCIDO"> {
  const m = await prisma.fotofficeMessage.findFirst({ where: { providerId: e.emailId, channel: "EMAIL" }, select: { id: true } });
  if (!m) return "DESCONOCIDO";
  const campo = e.field === "clickedAt" ? "openedAt" : e.field;
  if (campo !== "deliveredAt" && campo !== "openedAt") return "DUPLICADO";
  const r = await prisma.fotofficeMessage.updateMany({ where: { id: m.id, [campo]: null }, data: { [campo]: e.at } });
  return r.count > 0 ? "APLICADO" : "DUPLICADO";
}
