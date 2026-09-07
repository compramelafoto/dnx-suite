import "server-only";
import { prisma } from "@repo/db";
import { buildCardNotice } from "./notice";
import { shouldNotifyMember, type FulfillmentState } from "./fulfillment";
import { sendTransactionalEmail } from "@/lib/communications/send-email";

/**
 * Le avisa al socio que su carnet avanzó, y deja registrado el desenlace del aviso.
 *
 * Vive aparte porque un carnet se mueve por **dos caminos distintos**: la Secretaría o el
 * impresor lo empujan a mano, y la acreditación de un pago lo mete solo en la cola de
 * impresión. El segundo camino no avisaba nada: el socio pagaba su credencial y no volvía a
 * saber de ella hasta que estaba lista. Con el aviso viviendo dentro de la acción de pantalla,
 * ese silencio era inevitable.
 *
 * El resultado se guarda en el evento que originó el cambio —`noticeSentAt` o `noticeError`—
 * para que la Secretaría vea qué salió y qué no, y pueda reintentarlo.
 *
 * **Nunca lanza.** El cambio de estado ya ocurrió: el carnet se imprimió o el pago se acreditó,
 * y un correo que no sale no puede deshacer ninguna de las dos cosas.
 */
export async function notifyCardEvent(input: {
  cardId: string;
  /** Evento que registró el cambio; es donde se anota si el aviso salió. */
  eventId: string;
  state: FulfillmentState;
  note?: string | null;
}): Promise<void> {
  if (!shouldNotifyMember(input.state)) return;

  try {
    const card = await prisma.memberCard.findUnique({
      where: { id: input.cardId },
      select: {
        cardNumber: true,
        member: { select: { firstName: true, email: true } },
        workspace: { select: { name: true } },
      },
    });
    if (!card?.member.email) return;

    const aviso = buildCardNotice({
      firstName: card.member.firstName,
      institutionName: card.workspace.name,
      cardNumber: card.cardNumber,
      state: input.state,
      note: input.note ?? null,
    });
    if (!aviso) return;

    const salida = await sendTransactionalEmail({
      to: card.member.email,
      subject: aviso.subject,
      html: aviso.html,
      text: aviso.text,
    });

    await prisma.memberCardEvent.update({
      where: { id: input.eventId },
      data:
        salida.status === "SENT"
          ? { noticeSentAt: new Date(), noticeError: null }
          : { noticeError: `${salida.status}: ${salida.detail}`.slice(0, 300) },
    });
  } catch (error) {
    console.error("[fotoffice][carnet] no se pudo avisar el cambio de estado", {
      cardId: input.cardId,
      state: input.state,
      detalle: error instanceof Error ? error.message : "error desconocido",
    });
  }
}
