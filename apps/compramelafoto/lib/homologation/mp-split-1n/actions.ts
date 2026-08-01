"use server";

import { Role } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import type { CardPaymentSubmission } from "@repo/payments/frontend";
import { sanitizeCardPaymentSubmissionForLog } from "@repo/payments/frontend";
import { assertClfMpSplit1nHomologationSafe } from "./assert-safe-environment";
import { resolveHomologationScenario } from "./scenarios";
import { createClfMpSplit1nHomologationOrder } from "./create-homologation-order";
import { CLF_CARD_BRICK_HOMOLOGATION_SOURCE } from "./evidence-store";

export type HomologationPayInput = {
  scenarioId: string;
  cardPayment: CardPaymentSubmission;
  /** Display-only — ignored for charge amount. */
  clientDisplayedAmountMinor?: number;
  /** Must be ignored if present — server resolves receivers. */
  clientReceiverIds?: unknown;
  clientTotalMinor?: unknown;
};

export type HomologationPayResult =
  | {
      ok: true;
      uiState: "APPROVED" | "PROCESSING" | "REJECTED";
      userMessage: string;
      source: typeof CLF_CARD_BRICK_HOMOLOGATION_SOURCE;
      scenarioId: string;
      partnerCount: number;
      providerOrderIdPrefix: string;
      status: string;
      statusDetail: string | null;
      DEVICE_SESSION_PRESENT: true;
      deviceSessionIdLength: number;
      splitSumValid: boolean;
    }
  | { ok: false; code: string; message: string };

export async function submitClfMpSplit1nHomologationPaymentAction(
  input: HomologationPayInput,
): Promise<HomologationPayResult> {
  const safety = assertClfMpSplit1nHomologationSafe();
  if (!safety.ok) {
    return { ok: false, code: safety.code, message: safety.message };
  }

  const user = await getAuthUser();
  if (!user) {
    return { ok: false, code: "UNAUTHORIZED", message: "Authentication required" };
  }
  if (user.role !== Role.ADMIN && String(user.role) !== "SUPER_ADMIN") {
    return { ok: false, code: "FORBIDDEN", message: "Admin role required" };
  }

  // Explicitly ignore any client commercial tampering
  void input.clientReceiverIds;
  void input.clientTotalMinor;

  const scenario = resolveHomologationScenario(input.scenarioId);
  if (!scenario) {
    return { ok: false, code: "INVALID_SCENARIO", message: "Unknown scenario" };
  }

  const device = input.cardPayment?.deviceSessionId?.trim() ?? "";
  if (!device) {
    return {
      ok: false,
      code: "DEVICE_SESSION_REQUIRED",
      message: "MP_DEVICE_SESSION_ID missing — wait for Brick init",
    };
  }

  console.info(
    JSON.stringify({
      event: "HOMOLOGATION_SMOKE",
      phase: "submit",
      SOURCE: CLF_CARD_BRICK_HOMOLOGATION_SOURCE,
      SCENARIO: scenario.id,
      ...sanitizeCardPaymentSubmissionForLog(input.cardPayment),
      clientAmountIgnored: true,
      clientReceiversIgnored: true,
    }),
  );

  try {
    const result = await createClfMpSplit1nHomologationOrder({
      scenario,
      cardToken: input.cardPayment.token,
      paymentMethodId: input.cardPayment.paymentMethodId,
      installments: input.cardPayment.installments ?? 1,
      deviceSessionId: device,
      clientDisplayedAmountMinor: input.clientDisplayedAmountMinor,
    });

    const accredited =
      result.status === "PROCESSED_ACCREDITED" ||
      result.status === "PROCESSED";

    return {
      ok: true,
      uiState: accredited
        ? "APPROVED"
        : result.status.toLowerCase().includes("reject") ||
            result.status.toLowerCase().includes("fail")
          ? "REJECTED"
          : "PROCESSING",
      userMessage: accredited
        ? "Homologation Order acreditada en sandbox."
        : `Order status: ${result.status}`,
      source: result.source,
      scenarioId: result.scenarioId,
      partnerCount: result.partnerCount,
      providerOrderIdPrefix: result.providerOrderIdPrefix,
      status: result.status,
      statusDetail: result.statusDetail,
      DEVICE_SESSION_PRESENT: true,
      deviceSessionIdLength: result.deviceSessionIdLength,
      splitSumValid: result.splitSumValid,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 240) : "unknown";
    const providerCode =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: unknown }).code ?? "")
        : "";
    console.error(
      JSON.stringify({
        event: "HOMOLOGATION_SMOKE",
        phase: "error",
        SOURCE: CLF_CARD_BRICK_HOMOLOGATION_SOURCE,
        SCENARIO: scenario.id,
        DEVICE_SESSION_PRESENT: true,
        error: message,
        providerCode: providerCode || null,
        // never token / full device / secrets
      }),
    );
    const hint =
      /transactions failed|rejected|invalid_card|bad_filled|high_risk|call_for_authorize/i.test(
        message,
      )
        ? " Usá tarjeta TEST oficial MP con titular APRO (aprobada)."
        : "";
    return {
      ok: false,
      code: "ORDER_CREATE_FAILED",
      message: `${message}${hint}`,
    };
  }
}
