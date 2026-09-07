import "server-only";
import { prisma } from "@repo/db";
import { DETAIL_MAX } from "./constants";
import { sendTransactionalEmail, type SendOutcome } from "./send-email";

/**
 * Envía un email transaccional y deja constancia del desenlace.
 *
 * Existe porque el circuito de asociación manda siete correos distintos y cada uno repetía el
 * mismo bloque: enviar, mirar el resultado, escribir la fila, atrapar el error del registro
 * para que no tumbe la operación. Uno de esos cuatro pasos se iba a olvidar.
 *
 * **Nunca lanza.** Estos avisos salen después de hechos ya consumados —una solicitud aprobada,
 * un pago acreditado, un alta vencida— y ninguno de esos hechos puede deshacerse porque el
 * proveedor de correo esté caído. Quien llama decide si el fallo merece decirle algo a quien
 * está mirando la pantalla.
 */
export async function sendAndLogEmail(input: {
  to: string;
  templateKey: string;
  body: { subject: string; html: string; text: string };
  /** Usuario asociado, si lo hay. Un aspirante todavía no tiene cuenta: va en `null`. */
  userId?: number | null;
}): Promise<SendOutcome> {
  let outcome: SendOutcome;
  try {
    outcome = await sendTransactionalEmail({ to: input.to, ...input.body });
  } catch (error) {
    // El transporte promete no lanzar; si algún día rompe esa promesa, no se lleva puesta la
    // operación que lo llamó.
    outcome = {
      status: "INTERNAL_ERROR",
      detail: error instanceof Error ? error.message : "error desconocido",
    };
  }

  try {
    await prisma.sentEmailLog.create({
      data: {
        to: input.to,
        subject: input.body.subject,
        templateKey: input.templateKey,
        status: outcome.status,
        resendId: outcome.status === "SENT" ? outcome.providerId : null,
        error: outcome.status === "SENT" ? null : safeDetail(outcome.detail),
        userId: input.userId ?? null,
      },
    });
  } catch (error) {
    // El registro es diagnóstico: si falla, el email ya salió (o ya no salió) y su resultado
    // no cambia por no haberlo podido anotar.
    console.error("[fotoffice][comunicaciones] no se pudo registrar el envío", {
      templateKey: input.templateKey,
      detalle: error instanceof Error ? error.message : "error desconocido",
    });
  }

  return outcome;
}

/** Último filtro antes de la base: sin claves y acotado, aunque el detalle ya venga depurado. */
function safeDetail(detail: string): string {
  const redacted = detail.replace(/re_[A-Za-z0-9_-]{8,}/g, "[redactado]");
  return redacted.length > DETAIL_MAX ? `${redacted.slice(0, DETAIL_MAX - 1)}…` : redacted;
}
