/**
 * Generación automática de placas de participante (Template V2).
 *
 * Se dispara al confirmarse el pago y, como red de seguridad, desde el cron
 * `/api/cron/participant-cards`. Nunca revierte la inscripción: si el render
 * falla, la placa queda pendiente y el próximo ciclo del cron reintenta.
 */
import { prisma } from "@/lib/admin/db";
import {
  getOrGenerateClickatonParticipantCard,
  loadParticipantCardRegistration,
} from "./participant-card-persistence";
import {
  isParticipantCardsV2Enabled,
  isPersistenceEnabled,
} from "./participant-card-feature-flags";
import { validateParticipantCardsRuntimeConfig } from "./participant-card-runtime-config";
import type {
  ClickatonParticipantCardType,
  ParticipantCardActor,
} from "./participant-card-types";

export const AUTO_GENERATED_CARD_TYPES: ClickatonParticipantCardType[] = [
  "welcome",
  "member",
];

export type ParticipantCardAutoGenerateSkipReason =
  | "FLAG_OFF"
  | "RUNTIME_CONFIG_INVALID"
  | "REGISTRATION_NOT_FOUND"
  | "NO_ACTOR_IDENTITY"
  | "NOT_ELIGIBLE"
  | "RENDER_FAILED";

export type ParticipantCardAutoGenerateOutcome = {
  cardType: ClickatonParticipantCardType;
  ok: boolean;
  cacheStatus?: "HIT" | "MISS" | "REGENERATED";
  renderHashPrefix?: string;
  skipReason?: ParticipantCardAutoGenerateSkipReason;
  errorCode?: string;
  errorMessage?: string;
};

export type ParticipantCardAutoGenerateResult = {
  registrationId: string;
  attempted: boolean;
  outcomes: ParticipantCardAutoGenerateOutcome[];
};

/** True si la autogeneración está habilitada y bien configurada en este runtime. */
export function isParticipantCardAutoGenerationEnabled(): boolean {
  if (!isPersistenceEnabled()) return false;
  if (!isParticipantCardsV2Enabled()) return false;
  return validateParticipantCardsRuntimeConfig().ok;
}

function skippedResult(
  registrationId: string,
  cardTypes: ClickatonParticipantCardType[],
  skipReason: ParticipantCardAutoGenerateSkipReason
): ParticipantCardAutoGenerateResult {
  return {
    registrationId,
    attempted: false,
    outcomes: cardTypes.map((cardType) => ({ cardType, ok: false, skipReason })),
  };
}

/**
 * El sistema genera la placa en nombre del propio participante, así que el
 * actor se arma desde la inscripción: nunca amplía permisos sobre otra.
 */
function buildSystemActorFor(registration: {
  userId: number | null;
  email: string;
}): ParticipantCardActor | null {
  if (typeof registration.userId === "number") {
    return { kind: "participant", userId: registration.userId, email: registration.email };
  }
  if (registration.email.trim()) {
    return { kind: "participant", email: registration.email };
  }
  return null;
}

export async function autoGenerateParticipantCardsForRegistration(input: {
  registrationId: string;
  cardTypes?: ClickatonParticipantCardType[];
}): Promise<ParticipantCardAutoGenerateResult> {
  const cardTypes = input.cardTypes ?? AUTO_GENERATED_CARD_TYPES;

  if (!isPersistenceEnabled() || !isParticipantCardsV2Enabled()) {
    return skippedResult(input.registrationId, cardTypes, "FLAG_OFF");
  }

  const runtime = validateParticipantCardsRuntimeConfig();
  if (!runtime.ok) {
    return skippedResult(input.registrationId, cardTypes, "RUNTIME_CONFIG_INVALID");
  }

  const registration = await loadParticipantCardRegistration(input.registrationId);
  if (!registration) {
    return skippedResult(input.registrationId, cardTypes, "REGISTRATION_NOT_FOUND");
  }

  const actor = buildSystemActorFor(registration);
  if (!actor) {
    return skippedResult(input.registrationId, cardTypes, "NO_ACTOR_IDENTITY");
  }

  const outcomes: ParticipantCardAutoGenerateOutcome[] = [];

  for (const cardType of cardTypes) {
    try {
      const result = await getOrGenerateClickatonParticipantCard({
        registrationId: input.registrationId,
        cardType,
        actor,
        mode: "final",
      });
      outcomes.push({
        cardType,
        ok: true,
        cacheStatus: result.cacheStatus,
        renderHashPrefix: result.renderHashPrefix,
      });
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: string }).code)
          : undefined;
      // Falta de foto/consentimiento no es un error del sistema: la placa se
      // generará cuando el participante complete su perfil.
      const notEligible =
        code === "CLICKATON_CARD_PHOTO_REQUIRED" ||
        code === "CLICKATON_CARD_CONSENT_REQUIRED" ||
        code === "CLICKATON_CARD_NOT_ELIGIBLE";
      outcomes.push({
        cardType,
        ok: false,
        skipReason: notEligible ? "NOT_ELIGIBLE" : "RENDER_FAILED",
        errorCode: code,
        errorMessage:
          err instanceof Error ? err.message.slice(0, 200) : "error desconocido",
      });
    }
  }

  return { registrationId: input.registrationId, attempted: true, outcomes };
}

/** Soft-fail para el hot path de checkout: nunca propaga el error. */
export function enqueueParticipantCardsAfterPaid(input: {
  registrationId: string;
}): void {
  if (!isParticipantCardAutoGenerationEnabled()) return;
  void autoGenerateParticipantCardsForRegistration({
    registrationId: input.registrationId,
  }).catch(() => {
    /* el cron reintenta; el pago sigue confirmado */
  });
}

export type ProcessDueParticipantCardsResult = {
  enabled: boolean;
  scanned: number;
  processed: number;
  generated: number;
  failed: number;
  results: ParticipantCardAutoGenerateResult[];
};

/**
 * Red de seguridad: recorre inscripciones confirmadas con foto que todavía no
 * tienen las dos placas en estado READY y las genera.
 */
export async function processDueParticipantCards(
  limit = 25
): Promise<ProcessDueParticipantCardsResult> {
  if (!isParticipantCardAutoGenerationEnabled()) {
    return { enabled: false, scanned: 0, processed: 0, generated: 0, failed: 0, results: [] };
  }

  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit) || 25));

  const candidates = await prisma.clickatonRegistration.findMany({
    where: {
      status: "CONFIRMED",
      profilePhotoAssetId: { not: null },
      imageUsageConsent: true,
      participantCards: {
        none: { status: "READY" },
      },
    },
    orderBy: { updatedAt: "asc" },
    take: safeLimit,
    select: { id: true },
  });

  const results: ParticipantCardAutoGenerateResult[] = [];
  let generated = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const result = await autoGenerateParticipantCardsForRegistration({
      registrationId: candidate.id,
    });
    results.push(result);
    for (const outcome of result.outcomes) {
      if (outcome.ok) generated += 1;
      else if (outcome.skipReason === "RENDER_FAILED") failed += 1;
    }
  }

  return {
    enabled: true,
    scanned: candidates.length,
    processed: results.length,
    generated,
    failed,
    results,
  };
}
