"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireActiveWorkspace } from "@/lib/workspace";
import {
  checkTransition,
  shouldNotifyMember,
  type FulfillmentState,
} from "@/lib/carnet/fulfillment";
import { buildCardNotice } from "@/lib/carnet/notice";
import { resolveCardCapabilities } from "@/lib/carnet/operators";
import { sendTransactionalEmail } from "@/lib/communications/send-email";

export type AdvanceCardResult = { ok: true } | { ok: false; error: string };

const ESTADOS = new Set<FulfillmentState>([
  "PENDIENTE_PAGO",
  "EN_COLA",
  "IMPRESO",
  "LISTO_PARA_RETIRAR",
  "ENVIADO",
  "ENTREGADO",
  "ANULADO",
]);

/**
 * Mueve un carnet físico al siguiente paso.
 *
 * El cambio de estado y el evento se guardan **juntos**: un estado que avanzó sin dejar
 * registro de quién lo movió es exactamente lo que esta trazabilidad viene a evitar.
 */
export async function advanceCardFulfillmentAction(
  formData: FormData,
): Promise<AdvanceCardResult> {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) return { ok: false, error: "No hay una institución activa." };

  const cardId = String(formData.get("cardId") ?? "").trim();
  const destino = String(formData.get("toState") ?? "").trim() as FulfillmentState;
  const nota = String(formData.get("note") ?? "").trim() || null;

  if (!cardId || !ESTADOS.has(destino)) {
    return { ok: false, error: "El pedido no es válido." };
  }

  const card = await prisma.memberCard.findFirst({
    where: { id: cardId, workspaceId: workspace.id },
    select: {
      id: true,
      fulfillmentState: true,
      format: true,
      cardNumber: true,
      member: { select: { firstName: true, email: true } },
    },
  });
  if (!card) return { ok: false, error: "No encontramos ese carnet." };
  if (card.format !== "PRINTED") {
    return { ok: false, error: "El carnet digital no se imprime ni se entrega." };
  }

  const origen = (card.fulfillmentState ?? "PENDIENTE_PAGO") as FulfillmentState;
  const capabilities = await resolveCardCapabilities(user.id, workspace.id);

  const control = checkTransition({ from: origen, to: destino, capabilities, note: nota });
  if (!control.ok) return { ok: false, error: control.message };

  const eventoId = await prisma.$transaction(async (tx) => {
    await tx.memberCard.update({
      where: { id: card.id },
      data: { fulfillmentState: destino, fulfillmentUpdatedAt: new Date() },
    });
    const evento = await tx.memberCardEvent.create({
      data: {
        cardId: card.id,
        fromState: origen,
        toState: destino,
        actorUserId: user.id,
        // Instantánea del actor: la historia tiene que entenderse dentro de cinco años,
        // aunque esa persona ya no esté en el sistema.
        actorLabel: user.name?.trim() || user.email || null,
        note: nota,
      },
      select: { id: true },
    });
    return evento.id;
  });

  // El aviso sale DESPUÉS de confirmar el cambio: el carnet se imprimió, eso ya es cierto, y
  // un correo que no sale no puede deshacerlo. El resultado queda registrado en el evento
  // para que la Secretaría lo vea y reintente.
  if (shouldNotifyMember(destino) && card.member.email) {
    const aviso = buildCardNotice({
      firstName: card.member.firstName,
      institutionName: workspace.name,
      cardNumber: card.cardNumber,
      state: destino,
      note: nota,
    });
    if (aviso) {
      const salida = await sendTransactionalEmail({
        to: card.member.email,
        subject: aviso.subject,
        html: aviso.html,
        text: aviso.text,
      });
      await prisma.memberCardEvent.update({
        where: { id: eventoId },
        data:
          salida.status === "SENT"
            ? { noticeSentAt: new Date(), noticeError: null }
            : { noticeError: `${salida.status}: ${salida.detail}`.slice(0, 300) },
      });
    }
  }

  revalidatePath("/members/carnets");
  return { ok: true };
}
