import { prisma } from "@/lib/prisma";
import type { ConsentimientoGuardado, EstadoMp, RepositorioConsentimiento } from "./servicio";
import { normalizarEstadoMp } from "./servicio";

/**
 * Guarda los consentimientos en las tablas de DNX Payments que ya existen en la base de CLF
 * (`DnxPaymentRecipient` y `DnxSplitConsent`): no hace falta migración.
 *
 * - Un `DnxPaymentRecipient` por usuario de CLF; `displayReference` es el correo de su cuenta de
 *   Mercado Pago. El consentimiento es de la cuenta, no del rol: el mismo sirve para cobrar
 *   como fotógrafo, organizador o referidor.
 * - Un `DnxSplitConsent` por `receiver_id`, de producción y de la cuenta cobradora.
 */
export function crearRepositorioConsentimiento(ownerUserId: string): RepositorioConsentimiento {
  const filtro = { provider: "MERCADOPAGO", environment: "PRODUCTION" } as const;

  function aGuardado(
    fila: {
      providerReceiverId: string | null;
      status: string;
      invitationReference: string | null;
      lastCheckedAt: Date | null;
      recipient: { userId: number | null; displayReference: string | null } | null;
    } | null,
  ): ConsentimientoGuardado | null {
    if (!fila?.providerReceiverId) return null;
    return {
      userId: fila.recipient?.userId ?? null,
      receiverId: fila.providerReceiverId,
      correo: fila.recipient?.displayReference ?? null,
      estado: normalizarEstadoMp(fila.status) ?? "PENDING",
      inviteUrl: fila.invitationReference,
      lastCheckedAt: fila.lastCheckedAt,
    };
  }

  const seleccion = {
    providerReceiverId: true,
    status: true,
    invitationReference: true,
    lastCheckedAt: true,
    recipient: { select: { userId: true, displayReference: true } },
  } as const;

  return {
    async buscarPorUsuario(userId) {
      const fila = await prisma.dnxSplitConsent.findFirst({
        where: { ...filtro, primaryProviderAccountReference: ownerUserId, recipient: { userId } },
        orderBy: { updatedAt: "desc" },
        select: seleccion,
      });
      return aGuardado(fila);
    },

    async buscarPorReceiver(receiverId) {
      const fila = await prisma.dnxSplitConsent.findFirst({
        where: { ...filtro, providerReceiverId: receiverId },
        select: seleccion,
      });
      return aGuardado(fila);
    },

    async guardar(userId, fila, ahora) {
      await prisma.$transaction(async (tx) => {
        const existente = await tx.dnxPaymentRecipient.findFirst({
          where: { userId },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
        const recipient = existente
          ? await tx.dnxPaymentRecipient.update({
              where: { id: existente.id },
              data: { displayReference: fila.correo },
              select: { id: true },
            })
          : await tx.dnxPaymentRecipient.create({
              data: { userId, recipientType: "PHOTOGRAPHER", displayReference: fila.correo },
              select: { id: true },
            });
        // Si cambió de cuenta de Mercado Pago, el consentimiento viejo deja de ser suyo: así
        // nunca hay dos receptores para la misma persona.
        await tx.dnxSplitConsent.updateMany({
          where: { ...filtro, recipientId: recipient.id, NOT: { providerReceiverId: fila.receiverId } },
          data: { recipientId: null },
        });
        const previo = await tx.dnxSplitConsent.findFirst({
          where: { ...filtro, providerReceiverId: fila.receiverId },
          select: { id: true },
        });
        if (previo) {
          await tx.dnxSplitConsent.update({
            where: { id: previo.id },
            data: {
              recipientId: recipient.id,
              status: fila.estado,
              ...(fila.inviteUrl ? { invitationReference: fila.inviteUrl } : {}),
              lastCheckedAt: ahora,
            },
          });
        } else {
          await tx.dnxSplitConsent.create({
            data: {
              ...filtro,
              primaryProviderAccountReference: ownerUserId,
              providerReceiverId: fila.receiverId,
              recipientId: recipient.id,
              status: fila.estado,
              invitationReference: fila.inviteUrl,
              lastCheckedAt: ahora,
              source: "APPLICATION",
            },
          });
        }
      });
    },

    async actualizarEstado(receiverId: string, estado: EstadoMp, ahora: Date) {
      await prisma.dnxSplitConsent.updateMany({
        where: { ...filtro, providerReceiverId: receiverId },
        data: { status: estado, lastCheckedAt: ahora },
      });
    },
  };
}
