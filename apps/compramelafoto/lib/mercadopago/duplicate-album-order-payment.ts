/**
 * Segundo pago sobre un pedido de álbum ya pagado (suele ser una compra nueva perdida): avisar, no ignorar.
 *
 * No devuelve plata sola (la devolución la decide una persona). Deja:
 * - un `console.error("[duplicate-payment]", …)` para los logs,
 * - un evento de auditoría `PAYMENT_DUPLICATE` sobre el pedido,
 * - un email al admin de la plataforma y otro al fotógrafo (cola de emails, idempotente).
 */

import { prisma } from "@/lib/prisma";
import type { PaymentInfo } from "@/lib/mercadopago";
import { queueEmail } from "@/lib/email-queue";
import { registerAuditEvent } from "@/lib/antifraud/audit";
import {
  buildDuplicatePaymentEmail,
  duplicatePaymentEmailIdempotencyKey,
  type DuplicatePaymentEmailInput,
} from "@/lib/mercadopago/duplicate-album-order-payment-rules";

function formatArgentinaDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

/**
 * Registra y avisa un pago duplicado. Nunca tira: un fallo al avisar no puede romper el
 * webhook ni la pantalla de pago aprobado.
 */
export async function reportDuplicateAlbumOrderPayment(params: {
  orderId: number;
  albumId: number;
  photographerUserId: number | null;
  originalPaymentId: string;
  duplicatePayment: PaymentInfo;
}): Promise<void> {
  const { orderId, albumId, photographerUserId, originalPaymentId, duplicatePayment } = params;
  const duplicatePaymentId = String(duplicatePayment.id);

  console.error("[duplicate-payment]", {
    orderId,
    albumId,
    originalPaymentId,
    duplicatePaymentId,
    amount: duplicatePayment.transaction_amount,
    currency: duplicatePayment.currency_id,
    dateApproved: duplicatePayment.date_approved,
  });

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        buyerEmail: true,
        buyerName: true,
        buyerPhone: true,
        album: { select: { title: true } },
      },
    });
    const photographer = photographerUserId
      ? await prisma.user.findUnique({
          where: { id: photographerUserId },
          select: { name: true, email: true },
        })
      : null;

    const emailInput: DuplicatePaymentEmailInput = {
      orderId,
      albumTitle: order?.album?.title ?? null,
      buyerName: order?.buyerName ?? null,
      buyerEmail: order?.buyerEmail ?? "(sin email)",
      buyerPhone: order?.buyerPhone ?? null,
      originalPaymentId,
      duplicatePaymentId,
      amountPesos: Number.isFinite(Number(duplicatePayment.transaction_amount))
        ? Number(duplicatePayment.transaction_amount)
        : null,
      approvedAtLabel: formatArgentinaDateTime(duplicatePayment.date_approved),
    };

    // Mismo destinatario que usa el formulario de contacto para avisos al admin.
    const adminEmail = process.env.ADMIN_EMAIL || "admin@compramelafoto.com";
    const adminMail = buildDuplicatePaymentEmail("admin", emailInput);
    const adminQueued = await queueEmail({
      to: adminEmail,
      subject: adminMail.subject,
      body: adminMail.body,
      priority: 1,
      idempotencyKey: duplicatePaymentEmailIdempotencyKey("admin", orderId, duplicatePaymentId),
    });

    // La primera vez que vemos este pago duplicado (los reintentos del webhook no repiten).
    if (adminQueued.queued) {
      await registerAuditEvent({
        targetOrderType: "ALBUM_ORDER",
        targetOrderId: orderId,
        targetAlbumId: albumId,
        eventType: "PAYMENT_DUPLICATE",
        metadata: {
          originalPaymentId,
          duplicatePaymentId,
          amount: duplicatePayment.transaction_amount,
          currency: duplicatePayment.currency_id,
          dateApproved: duplicatePayment.date_approved,
          externalReference: duplicatePayment.external_reference,
        },
      });
    }

    if (photographer?.email) {
      const photographerMail = buildDuplicatePaymentEmail(
        "photographer",
        emailInput,
        photographer.name
      );
      await queueEmail({
        to: photographer.email,
        subject: photographerMail.subject,
        body: photographerMail.body,
        priority: 2,
        idempotencyKey: duplicatePaymentEmailIdempotencyKey(
          "photographer",
          orderId,
          duplicatePaymentId
        ),
      });
    }
  } catch (err: unknown) {
    console.error("[duplicate-payment] no se pudo registrar o avisar", {
      orderId,
      duplicatePaymentId,
      err,
    });
  }
}
