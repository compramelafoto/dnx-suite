import { notifyPaidRegistrationConfirmed } from "@/lib/registration/notifications/notify-registration-lifecycle";

/**
 * Efectos posteriores a confirmar un pago: liquidación, FotoRank, placas,
 * solicitud editorial y correo de confirmación.
 *
 * Todos son soft-fail a propósito: una inscripción PAGA nunca se revierte
 * porque una cola secundaria falle. Los crons reintentan desde el outbox.
 *
 * NOTA: este bloque hoy está también embebido en `apply-payment-event.ts`
 * (camino webhook) y en `get-registration-payment-status.ts` (camino S2S al
 * volver el comprador). Unificarlos es trabajo pendiente; no se tocaron acá
 * para no arriesgar el único camino de confirmación que hoy funciona.
 */
export async function runPaidRegistrationEffects(input: {
  registrationId: string;
  editionId: string;
  userId: number | null;
  paymentOrderId: string;
  paidAt: Date;
  source: string;
  editionSlug?: string;
  onSoftFail?: (code: string, reason: string) => void;
}): Promise<void> {
  const soft = (code: string) => (err: unknown) => {
    input.onSoftFail?.(
      code,
      err instanceof Error ? err.message.slice(0, 120) : "unknown",
    );
  };

  // Proyección contable: marcar las asignaciones como cobradas.
  try {
    const { markOrderAllocationsPaid } = await import(
      "@/lib/admin/edition-finance/infrastructure/persist-order-allocations"
    );
    await markOrderAllocationsPaid(input.paymentOrderId);
  } catch (err) {
    soft("ALLOCATION_MARK_PAID_SOFT_FAIL")(err);
  }

  // Sincronización con FotoRank (durable).
  try {
    const { enqueueFotoRankSyncAfterPaid } = await import(
      "@/lib/fotorank-sync/infrastructure/prisma-fotorank-sync"
    );
    if (input.userId != null) {
      void enqueueFotoRankSyncAfterPaid({
        registrationId: input.registrationId,
        editionId: input.editionId,
        userId: input.userId,
        paymentOrderId: input.paymentOrderId,
        paidAt: input.paidAt,
      }).then((r) => {
        if (!r.ok) {
          input.onSoftFail?.("FOTORANK_SYNC_ENQUEUE_SOFT", r.reason ?? "unknown");
        }
      });
    }
  } catch (err) {
    soft("FOTORANK_SYNC_ENQUEUE_SOFT")(err);
  }

  // Placa de bienvenida.
  try {
    const { enqueueWelcomeCardAfterPaid } = await import("@/lib/welcome-card/enqueue");
    void enqueueWelcomeCardAfterPaid({
      registrationId: input.registrationId,
      editionId: input.editionId,
    });
  } catch (err) {
    soft("WELCOME_CARD_ENQUEUE_SOFT")(err);
  }

  // Placas de participante V2.
  try {
    const { enqueueParticipantCardsAfterPaid } = await import(
      "@/lib/participant-cards/participant-card-autogenerate"
    );
    enqueueParticipantCardsAfterPaid({ registrationId: input.registrationId });
  } catch (err) {
    soft("PARTICIPANT_CARDS_ENQUEUE_SOFT")(err);
  }

  // Solicitud editorial de publicación (nunca publica sola).
  try {
    const { enqueueWelcomePublishAfterPaid } = await import(
      "@/lib/social-publisher/enqueue-welcome-publish"
    );
    void enqueueWelcomePublishAfterPaid({
      registrationId: input.registrationId,
      editionId: input.editionId,
    });
  } catch (err) {
    soft("WELCOME_PUBLISH_ENQUEUE_SOFT")(err);
  }

  // Correo de confirmación. Nace acá: si no se confirma, nunca existe.
  void notifyPaidRegistrationConfirmed({
    registrationId: input.registrationId,
    editionSlug: input.editionSlug ?? "",
    source: input.source,
  });
}
