import { prisma } from "@repo/db";
import { DETAIL_MAX, TEST_EMAIL_TEMPLATE_KEY } from "./constants";

/**
 * Registro técnico de los envíos de prueba, sobre el `SentEmailLog` que ya existe.
 *
 * Sirve para dos cosas a la vez: diagnosticar qué pasó y alimentar el límite por usuario.
 * Por eso se registran también los intentos fallidos.
 *
 * Se usan únicamente los campos que el modelo ya tiene, cada uno para lo suyo. El workspace
 * NO se guarda: la tabla no tiene esa columna en esta etapa, y meterlo dentro de
 * `templateKey`, `subject` o `error` sería usar un campo para lo que no es y ensuciaría
 * tanto el diagnóstico como el conteo del límite.
 *
 * Qué tampoco entra: claves, headers de autorización ni cuerpos crudos del proveedor. El
 * detalle ya viene depurado del transporte; igual se vuelve a tachar y truncar, porque este
 * es el último punto antes de la base.
 */

export type TestEmailLogStatus =
  | "SENT"
  | "CONFIGURATION_ERROR"
  | "PROVIDER_REJECTED"
  | "INTERNAL_ERROR";

export type TestEmailLogInput = {
  userId: number;
  to: string;
  subject: string;
  status: TestEmailLogStatus;
  providerId?: string | null;
  detail?: string | null;
};

function safeDetail(detail: string | null | undefined): string | null {
  if (!detail) return null;
  const redacted = detail.replace(/re_[A-Za-z0-9_-]{8,}/g, "[redactado]");
  return redacted.length > DETAIL_MAX ? `${redacted.slice(0, DETAIL_MAX - 1)}…` : redacted;
}

export async function recordTestEmailAttempt(input: TestEmailLogInput): Promise<void> {
  try {
    await prisma.sentEmailLog.create({
      data: {
        to: input.to,
        subject: input.subject,
        templateKey: TEST_EMAIL_TEMPLATE_KEY,
        status: input.status,
        resendId: input.providerId ?? null,
        error: safeDetail(input.detail),
        userId: input.userId,
      },
    });
  } catch (error) {
    // El registro es diagnóstico: si falla, el envío ya ocurrió y su resultado no cambia.
    console.error("[fotoffice_communications] test_email_log_failed", {
      status: input.status,
      error: error instanceof Error ? error.message : "error desconocido",
    });
  }
}
