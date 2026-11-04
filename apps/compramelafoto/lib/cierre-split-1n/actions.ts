"use server";

import { Role } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import type { CardPaymentSubmission } from "@repo/payments/frontend";
import { sanitizeCardPaymentSubmissionForLog } from "@repo/payments/frontend";
import { resolveCierreConfig } from "./config";
import { crearOrdenCierreProduccion, CierreOrdenError } from "./create-production-order";

export type CierrePagoInput = {
  cardPayment: CardPaymentSubmission;
  /** Solo para mostrar. El servidor reconstruye el monto. */
  clientDisplayedAmountMinor?: number;
  /** Se ignoran a propósito: el servidor resuelve destinatarios y total. */
  clientReceiverIds?: unknown;
  clientTotalMinor?: unknown;
};

export type CierrePagoResult =
  | {
      ok: true;
      uiState: "APPROVED" | "PROCESSING" | "REJECTED";
      userMessage: string;
      /** Entero: es lo que hay que mandarle a Mercado Pago. */
      providerOrderId: string;
      status: string;
      statusDetail: string | null;
      liveMode: boolean | null;
      receptores: number;
      splitSumValid: boolean;
      evidenciaPath: string | null;
    }
  | { ok: false; code: string; message: string };

/**
 * Crea la orden productiva de cierre de homologación.
 *
 * Solo admin, solo con la bandera encendida, solo fuera del sitio desplegado. Mueve dinero
 * real: cada freno está puesto porque esto no debería poder dispararse por accidente.
 */
export async function crearOrdenCierreAction(
  input: CierrePagoInput,
): Promise<CierrePagoResult> {
  const resolved = resolveCierreConfig();
  if (!resolved.ok) {
    return { ok: false, code: resolved.error.code, message: resolved.error.message };
  }

  const user = await getAuthUser();
  if (!user) {
    return { ok: false, code: "UNAUTHORIZED", message: "Hace falta iniciar sesión." };
  }
  if (user.role !== Role.ADMIN && String(user.role) !== "SUPER_ADMIN") {
    return { ok: false, code: "FORBIDDEN", message: "Solo un administrador puede hacer esto." };
  }

  // Sondas de manipulación desde el navegador: el servidor las descarta.
  void input.clientReceiverIds;
  void input.clientTotalMinor;

  const device = input.cardPayment?.deviceSessionId?.trim() ?? "";
  if (!device) {
    return {
      ok: false,
      code: "DEVICE_SESSION_REQUIRED",
      message: "Esperá a que el formulario inicialice la sesión de seguridad.",
    };
  }

  const payerEmail = input.cardPayment?.payer?.email?.trim() || user.email || "";
  if (!payerEmail) {
    return {
      ok: false,
      code: "SIN_PAYER_EMAIL",
      message: "Falta el correo del pagador.",
    };
  }

  console.info(
    JSON.stringify({
      event: "CLF_CIERRE_SPLIT_1N",
      phase: "submit",
      ...sanitizeCardPaymentSubmissionForLog(input.cardPayment),
      clientAmountIgnored: true,
      clientReceiversIgnored: true,
    }),
  );

  try {
    const result = await crearOrdenCierreProduccion({
      cardToken: input.cardPayment.token,
      paymentMethodId: input.cardPayment.paymentMethodId,
      installments: input.cardPayment.installments ?? 1,
      deviceSessionId: device,
      payerEmail,
      ...(input.cardPayment.payer?.identification
        ? { payerIdentification: input.cardPayment.payer.identification }
        : {}),
    });

    const acreditada =
      result.status === "PROCESSED_ACCREDITED" || result.status === "PROCESSED";
    const rechazada = /reject|fail/i.test(result.status);

    return {
      ok: true,
      uiState: acreditada ? "APPROVED" : rechazada ? "REJECTED" : "PROCESSING",
      userMessage: acreditada
        ? "Orden productiva acreditada. Copiá el Order ID y mandáselo a Mercado Pago."
        : `Estado de la orden: ${result.status}`,
      providerOrderId: result.providerOrderId,
      status: result.status,
      statusDetail: result.statusDetail,
      liveMode: result.liveMode,
      receptores: result.receptores,
      splitSumValid: result.splitSumValid,
      evidenciaPath: result.evidenciaPath,
    };
  } catch (err) {
    const code = err instanceof CierreOrdenError ? err.code : "ORDEN_FALLIDA";
    const message = err instanceof Error ? err.message.slice(0, 240) : "Error desconocido";
    console.error(
      JSON.stringify({
        event: "CLF_CIERRE_SPLIT_1N",
        phase: "error",
        code,
        error: message,
      }),
    );
    return { ok: false, code, message };
  }
}
