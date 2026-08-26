/**
 * Servicio de checkout del concurso — única capa con acceso a datos.
 *
 * Flujo:
 *   1. Verificar configuración y política (fase, ventana, cantidad).
 *   2. Resolver el precio EN EL SERVIDOR (nunca del cliente).
 *   3. Crear o reutilizar la inscripción en PENDING_PAYMENT.
 *   4. Crear la preference de Checkout Pro.
 *   5. Devolver la URL de pago.
 *
 * La carga de fotografías NO se habilita acá: eso ocurre sólo cuando el webhook
 * confirma un pago aprobado con el importe correcto.
 */

import { prisma } from "@repo/db";

import { resolveServerPrice } from "../upcoming/service";
import { createContestRegistration, getMyContestRegistration } from "../registration";
import { checkConfigReadiness } from "./config";
import { decideCheckout } from "./policy";
import { assertPreferenceChargesExpected, buildPreferenceBody } from "./preference";
import { createPreference, resolveCheckoutUrl } from "./mp-client";

export type StartCheckoutInput = {
  contestId: string;
  participantUserId: number;
  /** Cantidad de fotografías del paquete. Lo único que aporta el cliente. */
  quantity: number;
  categoryId: string;
  rulesVersionId: string;
  rulesAccepted: boolean;
  licenseAccepted: boolean;
  declaredAgeYears?: number | null;
  promotionalOptIn?: boolean;
  rulesAcceptanceIp?: string | null;
  rulesAcceptanceUserAgent?: string | null;
  now?: Date;
};

export type StartCheckoutResult =
  | {
      ok: true;
      checkoutUrl: string;
      preferenceId: string;
      registrationId: string;
      amountMinor: number;
      pricePhaseCode: string;
    }
  | { ok: false; code: string; error: string };

export async function startContestCheckout(
  input: StartCheckoutInput,
): Promise<StartCheckoutResult> {
  const now = input.now ?? new Date();

  // 1. Configuración. Falla cerrado.
  const readiness = checkConfigReadiness();
  if (!readiness.ready) {
    return { ok: false, code: "CHECKOUT_NOT_CONFIGURED", error: readiness.reason };
  }
  const config = readiness.config;

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: {
      id: true,
      title: true,
      status: true,
      registrationOpensAt: true,
      registrationClosesAt: true,
      uploadPolicyJson: true,
    },
  });
  if (!contest) return { ok: false, code: "CONTEST_NOT_FOUND", error: "Concurso no encontrado." };

  const existing = await getMyContestRegistration(input.contestId, input.participantUserId);
  const existingStatus =
    existing?.status === "CONFIRMED"
      ? ("CONFIRMED" as const)
      : existing?.status === "PENDING_PAYMENT"
        ? ("PENDING_PAYMENT" as const)
        : ("NONE" as const);

  // 2. Política. La cantidad máxima sale de la política del concurso.
  const policy = parseMaxEntries(contest.uploadPolicyJson);
  const decision = decideCheckout({
    now,
    contestStatus: contest.status,
    configReady: true,
    registrationOpensAt: contest.registrationOpensAt,
    registrationClosesAt: contest.registrationClosesAt,
    quantity: input.quantity,
    maxPhotosPerParticipant: policy,
    existingRegistrationStatus: existingStatus,
  });
  if (!decision.allowed) {
    return { ok: false, code: decision.reason, error: decision.message };
  }

  // 3. Precio: calculado por el servidor a partir de fecha, etapa y elegibilidad.
  const price = await resolveServerPrice({
    contestId: input.contestId,
    userId: input.participantUserId,
    quantity: input.quantity,
    now,
  });
  if (!price.ok) {
    return { ok: false, code: price.reason, error: price.message };
  }

  // 4. Inscripción en PENDING_PAYMENT. Idempotente ante doble clic.
  const registration = await createContestRegistration({
    contestId: input.contestId,
    participantUserId: input.participantUserId,
    categoryId: input.categoryId,
    rulesVersionId: input.rulesVersionId,
    rulesAccepted: input.rulesAccepted,
    licenseAccepted: input.licenseAccepted,
    declaredAgeYears: input.declaredAgeYears ?? null,
    promotionalOptIn: input.promotionalOptIn,
    rulesAcceptanceIp: input.rulesAcceptanceIp ?? null,
    rulesAcceptanceUserAgent: input.rulesAcceptanceUserAgent ?? null,
    // El importe del paquete y el cupo que habilita.
    priceOverrideMinor: price.price.amountMinor,
    purchasedEntriesCount: input.quantity,
  });

  const registrationId = registration.registration.id;

  // 5. Preference. La clave de idempotencia evita duplicar si el usuario reintenta.
  const body = buildPreferenceBody({
    externalReference: registrationId,
    contestId: contest.id,
    contestTitle: contest.title,
    quantity: input.quantity,
    totalAmountMinor: price.price.amountMinor,
    pricePhaseCode: price.price.phaseCode,
    participantUserId: input.participantUserId,
    publicUrl: config.publicUrl!,
  });

  // Última barrera antes de enviar: que cobre exactamente lo calculado.
  assertPreferenceChargesExpected(body, price.price.amountMinor);

  try {
    const preference = await createPreference({
      accessToken: config.accessToken!,
      body,
      idempotencyKey: `fr-pref-${registrationId}-${price.price.amountMinor}`,
    });

    return {
      ok: true,
      checkoutUrl: resolveCheckoutUrl(preference, config.environment),
      preferenceId: preference.id,
      registrationId,
      amountMinor: price.price.amountMinor,
      pricePhaseCode: price.price.phaseCode,
    };
  } catch (error) {
    // La inscripción queda en PENDING_PAYMENT: el participante puede reintentar
    // y se reutiliza la misma fila.
    return {
      ok: false,
      code: "PREFERENCE_FAILED",
      error:
        error instanceof Error
          ? `No se pudo iniciar el pago: ${error.message}`
          : "No se pudo iniciar el pago.",
    };
  }
}

/** Lee `maxEntriesPerRegistration` de la política del concurso. Default 1. */
function parseMaxEntries(raw: unknown): number {
  if (!raw || typeof raw !== "object") return 1;
  const v = (raw as { maxEntriesPerRegistration?: unknown }).maxEntriesPerRegistration;
  if (typeof v === "number" && Number.isInteger(v) && v >= 1) return v;
  return 1;
}
