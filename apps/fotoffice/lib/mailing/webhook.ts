import "server-only";
import { prisma } from "@repo/db";
import { addOptOut } from "./opt-out";
import type { ParsedWebhookEvent } from "./webhook-events";

/**
 * Anota un aviso de Resend en la fila del destinatario. El primer aviso de cada tipo gana: si
 * Resend reintenta o el socio abre el correo diez veces, la fecha no se mueve.
 *
 * La cuenta de Resend es compartida con otras apps: un aviso de un correo que no es nuestro (no hay
 * fila con ese id) se ignora.
 */
export async function applyWebhookEvent(e: ParsedWebhookEvent): Promise<"APPLIED" | "DUPLICATE" | "UNKNOWN"> {
  const fila = await prisma.fotofficeEmailDelivery.findFirst({
    where: { resendId: e.emailId },
    select: { id: true, email: true, campaign: { select: { workspaceId: true } } },
  });
  if (!fila) return "UNKNOWN";

  const r = await prisma.fotofficeEmailDelivery.updateMany({
    where: { id: fila.id, [e.field]: null },
    data: { [e.field]: e.at },
  });

  // Rebote o queja de spam: no se le vuelve a escribir a esa casilla desde esta institución.
  if (e.optOut) await addOptOut(fila.campaign.workspaceId, fila.email, "all");

  return r.count === 1 ? "APPLIED" : "DUPLICATE";
}
