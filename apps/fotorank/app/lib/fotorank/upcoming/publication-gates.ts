/**
 * Gates de publicación — qué debe estar completo antes de cada transición.
 *
 * DRAFT → UPCOMING exige los datos mínimos de la tarjeta pública y del
 * consentimiento. UPCOMING → REGISTRATION_OPEN exige, además, todo lo legal,
 * el premio confirmado, el jurado confirmado y los pagos operativos.
 *
 * Funciones puras: reciben un snapshot del concurso y devuelven el detalle de
 * lo que falta. La UI las usa para mostrar el checklist; las server actions las
 * usan para impedir la transición.
 */

import type { ContestLifecyclePhase } from "./lifecycle";

/**
 * Modelo de cobro del concurso.
 *
 * DIRECT es el caso de "El País que Miramos": organizador y receptor son la
 * misma cuenta, así que no hay nada que distribuir y no interviene Split 1:N.
 */
export type ContestPaymentModel = "DIRECT" | "SPLIT_1N";

export type GateRequirement = {
  key: string;
  label: string;
  satisfied: boolean;
  /** Qué hay que hacer si falta. */
  hint?: string;
};

export type GateReport = {
  target: ContestLifecyclePhase;
  passed: boolean;
  requirements: GateRequirement[];
  missing: string[];
  /** Anulación administrativa deliberada y auditada. */
  overridden: boolean;
};

/** Snapshot del concurso para evaluar los gates. Sin acceso a datos. */
export type ContestGateSnapshot = {
  title: string | null;
  /** Bajada. */
  shortDescription: string | null;
  fullDescription: string | null;
  coverImageUrl: string | null;
  organizationName: string | null;
  timezone: string | null;

  // "Notificarme"
  interestBenefitCutoffAt: Date | null;
  benefitDeadlineAt: Date | null;
  consentVersion: string | null;
  privacyPolicyUrl: string | null;
  interestConfirmationTemplateValidated: boolean;
  communicationsSafeModeConfigured: boolean;
  previewApprovedAt: Date | null;

  // Legales
  organizerLegalName: string | null;
  organizerTaxId: string | null;
  organizerLegalAddress: string | null;
  organizerContactEmail: string | null;
  rulesPublishedVersionId: string | null;
  rulesLegalReviewApproved: boolean;

  // Jurado y premio
  judgesConfirmed: boolean;
  prize: PrizeGateSnapshot;

  // Comercial
  pricePhasesConfigured: boolean;
  /**
   * Modelo de cobro del concurso.
   *  - DIRECT: una sola cuenta cobra (organizador = receptor). Checkout Pro, sin split.
   *  - SPLIT_1N: el cobro se reparte entre varios receivers. Exige DNX Payments.
   */
  paymentModel: ContestPaymentModel;
  /** Checkout configurado y operativo (aplica a DIRECT). */
  checkoutConfigured: boolean;
  /** DNX Payments habilitado (aplica sólo a SPLIT_1N). */
  dnxPaymentsEnabled: boolean;
  /** Configuración de distribución validada (aplica sólo a SPLIT_1N). */
  dnxSplitConfigValidated: boolean;
  cancellationAndRefundPolicyDefined: boolean;
  purchaseTestApproved: boolean;
  photoEnablementTestApproved: boolean;
  transactionalEmailsValidated: boolean;
  scheduleConsistent: boolean;
};

/** Campos obligatorios del premio antes de publicar. Ninguno se inventa. */
export type PrizeGateSnapshot = {
  brand: string | null;
  model: string | null;
  includedLens: string | null;
  isNewProduct: boolean | null;
  warranty: string | null;
  referenceValue: string | null;
  supplier: string | null;
  deliveryMethod: string | null;
  shippingResponsible: string | null;
  shippingCostCoverage: string | null;
  officialImageUrl: string | null;
  outOfStockAlternative: string | null;
  technicalSponsor: string | null;
  /** Bandera administrativa visible mientras falten datos. */
  modelPendingConfirmation: boolean;
};

function present(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return value;
  return true;
}

/** Campos del premio que deben estar cargados antes de publicar. */
export const REQUIRED_PRIZE_FIELDS: Array<{ key: keyof PrizeGateSnapshot; label: string }> = [
  { key: "brand", label: "Marca" },
  { key: "model", label: "Modelo" },
  { key: "includedLens", label: "Lente incluido" },
  { key: "isNewProduct", label: "Condición de producto nuevo" },
  { key: "warranty", label: "Garantía" },
  { key: "referenceValue", label: "Valor de referencia" },
  { key: "supplier", label: "Proveedor" },
  { key: "deliveryMethod", label: "Forma de entrega" },
  { key: "shippingResponsible", label: "Responsable del envío" },
  { key: "shippingCostCoverage", label: "Cobertura del costo de envío" },
  { key: "officialImageUrl", label: "Imagen oficial autorizada" },
  { key: "outOfStockAlternative", label: "Alternativa por falta de stock" },
];

export function isPrizeConfirmed(prize: PrizeGateSnapshot): boolean {
  if (prize.modelPendingConfirmation) return false;
  return REQUIRED_PRIZE_FIELDS.every((f) => present(prize[f.key]));
}

export function listMissingPrizeFields(prize: PrizeGateSnapshot): string[] {
  const missing = REQUIRED_PRIZE_FIELDS.filter((f) => !present(prize[f.key])).map((f) => f.label);
  if (prize.modelPendingConfirmation) {
    missing.unshift("Confirmación del modelo del premio");
  }
  return missing;
}

function buildReport(
  target: ContestLifecyclePhase,
  requirements: GateRequirement[],
  overridden: boolean,
): GateReport {
  const missing = requirements.filter((r) => !r.satisfied).map((r) => r.label);
  return {
    target,
    passed: overridden || missing.length === 0,
    requirements,
    missing,
    overridden,
  };
}

/** Requisitos para que un concurso pase a "PRÓXIMAMENTE". */
export function evaluateUpcomingGate(
  snapshot: ContestGateSnapshot,
  options?: { override?: boolean },
): GateReport {
  const requirements: GateRequirement[] = [
    { key: "title", label: "Nombre", satisfied: present(snapshot.title) },
    { key: "shortDescription", label: "Bajada", satisfied: present(snapshot.shortDescription) },
    { key: "fullDescription", label: "Descripción", satisfied: present(snapshot.fullDescription) },
    {
      key: "coverImageUrl",
      label: "Imagen de tarjeta",
      satisfied: present(snapshot.coverImageUrl),
      hint: "Cargar la imagen definitiva. El placeholder administrativo no cuenta.",
    },
    { key: "organizer", label: "Organizador", satisfied: present(snapshot.organizationName) },
    {
      key: "interestCutoff",
      label: "Fecha límite del beneficio",
      satisfied: present(snapshot.interestBenefitCutoffAt) && present(snapshot.benefitDeadlineAt),
    },
    {
      key: "consentVersion",
      label: "Consentimiento versionado",
      satisfied: present(snapshot.consentVersion),
    },
    {
      key: "privacyPolicy",
      label: "Política de privacidad disponible",
      satisfied: present(snapshot.privacyPolicyUrl),
    },
    {
      key: "confirmationTemplate",
      label: "Plantilla de confirmación validada",
      satisfied: snapshot.interestConfirmationTemplateValidated,
    },
    {
      key: "safeMode",
      label: "Emails configurados en modo seguro",
      satisfied: snapshot.communicationsSafeModeConfigured,
    },
    { key: "timezone", label: "Huso horario", satisfied: present(snapshot.timezone) },
    {
      key: "previewApproved",
      label: "Preview aprobado",
      satisfied: present(snapshot.previewApprovedAt),
    },
  ];
  return buildReport("UPCOMING", requirements, Boolean(options?.override));
}

/** Requisitos para abrir inscripciones. Incluye todo lo del gate anterior. */
export function evaluateRegistrationOpenGate(
  snapshot: ContestGateSnapshot,
  options?: { override?: boolean },
): GateReport {
  const upcoming = evaluateUpcomingGate(snapshot);
  const missingPrizeFields = listMissingPrizeFields(snapshot.prize);

  const requirements: GateRequirement[] = [
    ...upcoming.requirements,
    {
      key: "organizerLegal",
      label: "Datos legales completos del organizador",
      satisfied:
        present(snapshot.organizerLegalName) &&
        present(snapshot.organizerTaxId) &&
        present(snapshot.organizerLegalAddress) &&
        present(snapshot.organizerContactEmail),
      hint: "Razón social, CUIT, domicilio legal y correo oficial. No pueden inventarse.",
    },
    {
      key: "rulesApproved",
      label: "Bases legales aprobadas",
      satisfied: snapshot.rulesLegalReviewApproved,
    },
    {
      key: "rulesPublished",
      label: "Versión publicada de las bases",
      satisfied: present(snapshot.rulesPublishedVersionId),
    },
    { key: "judges", label: "Jurados confirmados", satisfied: snapshot.judgesConfirmed },
    {
      key: "prize",
      label: "Premio confirmado",
      satisfied: isPrizeConfirmed(snapshot.prize),
      hint: missingPrizeFields.length > 0 ? `Faltan: ${missingPrizeFields.join(", ")}.` : undefined,
    },
    {
      key: "prizeModel",
      label: "Modelo de cámara confirmado",
      satisfied: !snapshot.prize.modelPendingConfirmation && present(snapshot.prize.model),
    },
    {
      key: "warrantyDelivery",
      label: "Garantía y entrega definidas",
      satisfied: present(snapshot.prize.warranty) && present(snapshot.prize.deliveryMethod),
    },
    {
      key: "prices",
      label: "Precios confirmados",
      satisfied: snapshot.pricePhasesConfigured,
    },
    // El modelo de cobro define qué se exige. Un concurso donde organizador y
    // receptor son la misma cuenta no reparte nada: exigirle una configuración
    // de split 1:N sería un bloqueo sin sentido.
    ...(snapshot.paymentModel === "SPLIT_1N"
      ? [
          {
            key: "payments",
            label: "DNX Payments habilitado",
            satisfied: snapshot.dnxPaymentsEnabled,
            hint: "Requiere la homologación de Split 1:N.",
          },
          {
            key: "split",
            label: "Configuración split 1:N validada",
            satisfied: snapshot.dnxSplitConfigValidated,
          },
        ]
      : [
          {
            key: "checkout",
            label: "Checkout configurado",
            satisfied: snapshot.checkoutConfigured,
            hint: "Cobro directo a una única cuenta: no requiere split 1:N.",
          },
        ]),
    {
      key: "refundPolicy",
      label: "Política de cancelación y reembolso",
      satisfied: snapshot.cancellationAndRefundPolicyDefined,
    },
    {
      key: "purchaseTest",
      label: "Test de compra aprobado",
      satisfied: snapshot.purchaseTestApproved,
    },
    {
      key: "photoEnablementTest",
      label: "Test de habilitación de fotografías",
      satisfied: snapshot.photoEnablementTestApproved,
    },
    {
      key: "transactionalEmails",
      label: "Correos transaccionales validados",
      satisfied: snapshot.transactionalEmailsValidated,
    },
    {
      key: "schedule",
      label: "Cronograma consistente",
      satisfied: snapshot.scheduleConsistent,
    },
  ];

  return buildReport("REGISTRATION_OPEN", requirements, Boolean(options?.override));
}

/** Gate correspondiente a la fase destino. Otras transiciones no tienen gate de contenido. */
export function evaluateGateForTarget(
  target: ContestLifecyclePhase,
  snapshot: ContestGateSnapshot,
  options?: { override?: boolean },
): GateReport | null {
  if (target === "UPCOMING") return evaluateUpcomingGate(snapshot, options);
  if (target === "REGISTRATION_OPEN") return evaluateRegistrationOpenGate(snapshot, options);
  return null;
}
