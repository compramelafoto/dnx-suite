import type {
  ClickatonParticipantCardType,
  ParticipantCardEligibility,
  ParticipantCardMode,
  ParticipantCardRegistrationSnapshot,
  ParticipantCardWarning,
} from "./participant-card-types";

const BLOCKED_STATUSES = new Set([
  "CANCELLED",
  "REFUNDED",
  "DISQUALIFIED",
  "DRAFT",
  "PENDING_PAYMENT",
]);

const ALLOWED_PAYMENT_STATUSES = new Set(["APPROVED", "NOT_REQUIRED"]);

export type EvaluateClickatonCardEligibilityInput = {
  registration: ParticipantCardRegistrationSnapshot;
  cardType: ClickatonParticipantCardType;
  mode: ParticipantCardMode;
  actorKind: "participant" | "admin";
  /** Admin preview permite MANUAL_REVIEW como warning, no bloqueo. */
  allowAdminPreview?: boolean;
  hasConsent: boolean;
  hasPhoto: boolean;
};

function warn(
  code: ParticipantCardWarning["code"],
  message: string
): ParticipantCardWarning {
  return { code, message };
}

export function evaluateClickatonCardEligibility(
  input: EvaluateClickatonCardEligibilityInput
): ParticipantCardEligibility {
  const warnings: ParticipantCardWarning[] = [];
  const { registration, cardType, mode, actorKind, allowAdminPreview } = input;
  const isAdminPreview =
    actorKind === "admin" && (mode === "preview" || allowAdminPreview === true);

  const hasName =
    registration.firstName.trim().length > 0 || registration.lastName.trim().length > 0;
  if (!hasName) {
    return {
      eligible: false,
      blocked: true,
      warnings,
      blockReason: "Nombre del participante incompleto",
    };
  }

  if (BLOCKED_STATUSES.has(registration.status)) {
    return {
      eligible: false,
      blocked: true,
      warnings,
      blockReason: `Estado de inscripción no permitido: ${registration.status}`,
    };
  }

  if (registration.status !== "CONFIRMED") {
    if (isAdminPreview) {
      warnings.push(
        warn(
          "PAYMENT_MANUAL_REVIEW",
          `Estado ${registration.status}: solo preview administrativo`
        )
      );
    } else {
      return {
        eligible: false,
        blocked: true,
        warnings,
        blockReason: `Inscripción no confirmada (${registration.status})`,
      };
    }
  }

  if (!ALLOWED_PAYMENT_STATUSES.has(registration.paymentStatus)) {
    if (registration.paymentStatus === "MANUAL_REVIEW" && isAdminPreview) {
      warnings.push(
        warn(
          "PAYMENT_MANUAL_REVIEW",
          "Pago en revisión manual: preview administrativo permitido"
        )
      );
    } else {
      return {
        eligible: false,
        blocked: true,
        warnings,
        blockReason: `Estado de pago no permitido: ${registration.paymentStatus}`,
      };
    }
  }

  if (cardType === "welcome" && !registration.edition.startAt) {
    if (isAdminPreview) {
      warnings.push(
        warn(
          "EVENT_DATE_MISSING",
          "Fecha del evento ausente: la placa de bienvenida puede quedar incompleta"
        )
      );
    } else {
      return {
        eligible: false,
        blocked: true,
        warnings,
        blockReason: "Fecha del evento requerida para placa de bienvenida",
      };
    }
  }

  if (cardType === "member" && !registration.edition.startAt) {
    warnings.push(
      warn(
        "EVENT_DATE_MISSING",
        "Fecha del evento ausente: placa de pertenencia generada con advertencia"
      )
    );
  }

  if (
    !registration.instagramHandle?.trim() &&
    !registration.instagramHandleNormalized?.trim()
  ) {
    warnings.push(
      warn("INSTAGRAM_MISSING", "Instagram no informado: se generará con campo vacío")
    );
  }

  if (!input.hasConsent) {
    if (isAdminPreview) {
      warnings.push(
        warn(
          "CONSENT_MISSING",
          "Consentimiento de imagen/términos ausente: preview administrativo"
        )
      );
    } else if (mode === "final" && actorKind === "participant") {
      return {
        eligible: false,
        blocked: true,
        warnings,
        blockReason: "Consentimiento de imagen o términos requerido",
      };
    }
  }

  if (!input.hasPhoto) {
    if (isAdminPreview) {
      warnings.push(
        warn("PHOTO_PLACEHOLDER", "Foto ausente: se usará placeholder en preview")
      );
    } else if (mode === "final" && actorKind === "participant") {
      return {
        eligible: false,
        blocked: true,
        warnings,
        blockReason: "Foto de perfil requerida",
      };
    }
  }

  return {
    eligible: true,
    blocked: false,
    warnings,
  };
}
