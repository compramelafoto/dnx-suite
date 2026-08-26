/**
 * Selfcheck de la capacidad "concursos próximos".
 *
 * Cubre la lógica pura: ciclo de vida, consentimientos, idempotencia del
 * registro de interés, resolución de precios del lado servidor, política de
 * comunicaciones y gates de publicación.
 *
 * No toca la base de datos. La parte con persistencia vive en
 * `upcoming.integration.selfcheck.ts`.
 *
 * Uso: pnpm --filter fotorank test:upcoming:selfcheck
 */
import assert from "node:assert/strict";

import {
  acceptsInterestRegistration,
  canAcceptPayments,
  canAcceptSubmissions,
  canTransition,
  getLifecycleCapabilities,
  isPubliclyVisibleStatus,
  PUBLICLY_VISIBLE_STATUSES,
  requiresExplicitAdminAction,
} from "./lifecycle";
import { CONSENT_TEXTS, CURRENT_CONSENT_VERSION, validateConsent } from "./consent";
import {
  computeInterestStats,
  decideCancelInterest,
  decideRegisterInterest,
  isBenefitEligibleAt,
  toPricingEligibility,
  type ExistingInterest,
  type InterestContestContext,
} from "./interest";
import {
  assertClientAmountMatches,
  canUseInterestExclusivePhase,
  formatMinorAmount,
  resolvePrice,
  type InterestEligibility,
  type PricePhase,
} from "./pricing";
import {
  buildIdempotencyKey,
  decideDispatch,
  hasValidConsent,
  resolveDispatchEnvironment,
  type RecipientConsentState,
} from "./communications";
import {
  evaluateRegistrationOpenGate,
  evaluateUpcomingGate,
  isPrizeConfirmed,
  listMissingPrizeFields,
  type ContestGateSnapshot,
} from "./publication-gates";
import { isDnxPaymentsEnabled, assertPaymentsAvailable } from "./payments-integration";
import {
  PRICE_PHASES,
  SCHEDULE_UTC,
  TIMEZONE,
  local,
  PRIZE_SNAPSHOT,
  EVALUATION_CRITERIA,
} from "./contests/el-pais-que-miramos/definition";
import {
  EL_PAIS_QUE_MIRAMOS_RULES_DRAFT,
  contentHasLegalPlaceholder,
  listLegalPlaceholders,
} from "./contests/el-pais-que-miramos/rules-draft";

const checks: string[] = [];
function section(name: string) {
  checks.push(name);
}

// ===========================================================================
// 1. Ciclo de vida y visibilidad pública
// ===========================================================================
section("ciclo de vida");

// Un concurso DRAFT no aparece públicamente.
assert.equal(isPubliclyVisibleStatus("DRAFT"), false);
assert.equal(PUBLICLY_VISIBLE_STATUSES.includes("DRAFT" as never), false);

// Un concurso UPCOMING aparece y muestra "Notificarme".
assert.equal(isPubliclyVisibleStatus("UPCOMING"), true);
assert.equal(acceptsInterestRegistration("UPCOMING"), true);

// UPCOMING no permite pagos ni carga de fotografías.
assert.equal(canAcceptSubmissions("UPCOMING"), false);
assert.equal(canAcceptPayments({ status: "UPCOMING", dnxPaymentsEnabled: true }), false);

// REGISTRATION_OPEN sólo cobra si DNX Payments está habilitado.
assert.equal(canAcceptPayments({ status: "REGISTRATION_OPEN", dnxPaymentsEnabled: false }), false);
assert.equal(canAcceptPayments({ status: "REGISTRATION_OPEN", dnxPaymentsEnabled: true }), true);

// Sólo UPCOMING acepta registro de interés.
for (const s of ["DRAFT", "REGISTRATION_OPEN", "JUDGING", "COMPLETED", "CANCELLED", "PUBLISHED"]) {
  assert.equal(acceptsInterestRegistration(s), false, `${s} no debe aceptar interés`);
}

// Estados legacy conservan su comportamiento histórico.
assert.equal(isPubliclyVisibleStatus("PUBLISHED"), true);
assert.equal(isPubliclyVisibleStatus("ACTIVE"), true);
assert.equal(isPubliclyVisibleStatus("ARCHIVED"), false);
assert.equal(isPubliclyVisibleStatus("SETUP_IN_PROGRESS"), false);
assert.equal(getLifecycleCapabilities("PUBLISHED").allowsSubmissions, true);

// Un estado desconocido se trata como borrador (falla cerrado).
assert.equal(isPubliclyVisibleStatus("LO_QUE_SEA"), false);

// Transiciones.
assert.equal(canTransition("DRAFT", "UPCOMING").allowed, true);
assert.equal(canTransition("UPCOMING", "REGISTRATION_OPEN").allowed, true);
assert.equal(canTransition("DRAFT", "REGISTRATION_OPEN").allowed, false);
assert.equal(canTransition("COMPLETED", "DRAFT").allowed, false);
assert.equal(canTransition("PUBLISHED", "UPCOMING").allowed, false); // legacy no se migra solo
assert.equal(requiresExplicitAdminAction("DRAFT", "UPCOMING"), true);
assert.equal(requiresExplicitAdminAction("UPCOMING", "REGISTRATION_OPEN"), true);

// ===========================================================================
// 2. Consentimientos
// ===========================================================================
section("consentimientos");

// Ninguna casilla opcional viene premarcada.
assert.equal(CONSENT_TEXTS.GENERAL.defaultChecked, false);
assert.equal(CONSENT_TEXTS.CONTEST_SPECIFIC.defaultChecked, false);
assert.equal(CONSENT_TEXTS.GENERAL.required, false);
assert.equal(CONSENT_TEXTS.CONTEST_SPECIFIC.required, true);

// El consentimiento específico es condición para registrar.
assert.equal(validateConsent({ contestSpecificOptIn: false, generalOptIn: true }).ok, false);
const okConsent = validateConsent({ contestSpecificOptIn: true, generalOptIn: false });
assert.equal(okConsent.ok, true);
assert.equal(okConsent.ok && okConsent.version, CURRENT_CONSENT_VERSION);

// ===========================================================================
// 3. Registro de interés: idempotencia y elegibilidad
// ===========================================================================
section("registro de interés");

const CUTOFF = SCHEDULE_UTC.interestBenefitCutoffAt;
const BENEFIT_DEADLINE = SCHEDULE_UTC.promoPriceEndsAt;

const contestUpcoming: InterestContestContext = {
  contestId: "c1",
  status: "UPCOMING",
  interestBenefitCutoffAt: CUTOFF,
  benefitDeadlineAt: BENEFIT_DEADLINE,
};

const beforeCutoff = local("2026-09-01T12:00:00");
const afterCutoff = local("2026-09-21T00:00:01");

// Primer registro: crea y queda elegible.
const first = decideRegisterInterest({
  now: beforeCutoff,
  contest: contestUpcoming,
  existing: null,
  consent: { contestSpecificOptIn: true, generalOptIn: false },
});
assert.equal(first.action, "CREATE");
assert.equal(first.action === "CREATE" && first.data.benefitEligible, true);
assert.equal(
  first.action === "CREATE" && first.data.benefitDeadlineAt?.getTime(),
  BENEFIT_DEADLINE.getTime(),
);
assert.equal(first.action === "CREATE" && first.data.consentVersion, CURRENT_CONSENT_VERSION);
assert.equal(first.action === "CREATE" && first.data.generalOptIn, false);

const existingActive: ExistingInterest = {
  id: "i1",
  status: "ACTIVE",
  registeredAt: beforeCutoff,
  benefitDeadlineAt: BENEFIT_DEADLINE,
  benefitEligible: true,
  consentVersion: CURRENT_CONSENT_VERSION,
  generalOptIn: false,
};

// Repetir "Notificarme" es idempotente: no crea ni extiende nada.
const repeated = decideRegisterInterest({
  now: local("2026-09-10T12:00:00"),
  contest: contestUpcoming,
  existing: existingActive,
  consent: { contestSpecificOptIn: true, generalOptIn: false },
});
assert.equal(repeated.action, "NOOP");
assert.equal(repeated.action === "NOOP" && repeated.auditAction, "REPEATED");

// Repetirlo DESPUÉS del corte tampoco quita ni agrega elegibilidad.
const repeatedLate = decideRegisterInterest({
  now: afterCutoff,
  contest: contestUpcoming,
  existing: existingActive,
  consent: { contestSpecificOptIn: true, generalOptIn: false },
});
assert.equal(repeatedLate.action, "NOOP");

// Cambiar el opt-in general se registra como cambio auditado e independiente.
const optInChange = decideRegisterInterest({
  now: beforeCutoff,
  contest: contestUpcoming,
  existing: existingActive,
  consent: { contestSpecificOptIn: true, generalOptIn: true },
});
assert.equal(optInChange.action, "NOOP");
assert.equal(optInChange.action === "NOOP" && optInChange.auditAction, "GENERAL_OPT_IN_CHANGED");
assert.equal(optInChange.action === "NOOP" && optInChange.generalOptIn, true);

// Registrarse después del corte: se registra pero SIN beneficio.
const late = decideRegisterInterest({
  now: afterCutoff,
  contest: contestUpcoming,
  existing: null,
  consent: { contestSpecificOptIn: true, generalOptIn: false },
});
assert.equal(late.action, "CREATE");
assert.equal(late.action === "CREATE" && late.data.benefitEligible, false);
assert.equal(late.action === "CREATE" && late.data.benefitDeadlineAt, null);

// El instante exacto del corte todavía es elegible; 1 ms después no.
assert.equal(isBenefitEligibleAt(CUTOFF, CUTOFF), true);
assert.equal(isBenefitEligibleAt(new Date(CUTOFF.getTime() + 1), CUTOFF), false);

// Sin consentimiento específico no se registra nada.
assert.equal(
  decideRegisterInterest({
    now: beforeCutoff,
    contest: contestUpcoming,
    existing: null,
    consent: { contestSpecificOptIn: false, generalOptIn: true },
  }).action,
  "REJECT",
);

// En DRAFT no se puede registrar interés.
assert.equal(
  decideRegisterInterest({
    now: beforeCutoff,
    contest: { ...contestUpcoming, status: "DRAFT" },
    existing: null,
    consent: { contestSpecificOptIn: true, generalOptIn: false },
  }).action,
  "REJECT",
);

// Cancelar marca CANCELLED; nunca borra.
const cancel = decideCancelInterest({ now: beforeCutoff, existing: existingActive });
assert.equal(cancel.action, "CANCEL");
assert.equal(cancel.action === "CANCEL" && cancel.auditAction, "CANCELLED");
// No existe ninguna decisión "DELETE" en el contrato: la fila y su auditoría persisten.
assert.equal(Object.prototype.hasOwnProperty.call(cancel, "delete"), false);

// Cancelar dos veces es idempotente.
const cancelled: ExistingInterest = { ...existingActive, status: "CANCELLED" };
assert.equal(decideCancelInterest({ now: beforeCutoff, existing: cancelled }).action, "NOOP");

// Reactivar conserva la elegibilidad original (no la recalcula ni la extiende).
const reactivate = decideRegisterInterest({
  now: afterCutoff,
  contest: contestUpcoming,
  existing: cancelled,
  consent: { contestSpecificOptIn: true, generalOptIn: false },
});
assert.equal(reactivate.action, "REACTIVATE");
assert.equal(
  Object.prototype.hasOwnProperty.call(
    reactivate.action === "REACTIVATE" ? reactivate.data : {},
    "benefitDeadlineAt",
  ),
  false,
  "reactivar no debe tocar la fecha del beneficio",
);

// El puente hacia el motor de precios refleja el estado real del interés.
assert.equal(toPricingEligibility(null), null);
assert.deepEqual(toPricingEligibility(existingActive), {
  benefitEligible: true,
  benefitDeadlineAt: BENEFIT_DEADLINE,
  active: true,
});
// Un interés cancelado deja de ser activo para el motor de precios.
assert.equal(toPricingEligibility(cancelled)!.active, false);
// Un interés ya convertido en inscripción sigue contando como activo.
assert.equal(toPricingEligibility({ ...existingActive, status: "CONVERTED" })!.active, true);

// Estadísticas administrativas.
const stats = computeInterestStats([
  { status: "ACTIVE", benefitEligible: true },
  { status: "ACTIVE", benefitEligible: false },
  { status: "CANCELLED", benefitEligible: true },
  { status: "CONVERTED", benefitEligible: true },
]);
assert.deepEqual(stats, {
  total: 4,
  active: 2,
  cancelled: 1,
  converted: 1,
  benefitEligible: 3,
  conversionRate: 25,
});

// ===========================================================================
// 4. Precios del lado servidor
// ===========================================================================
section("precios");

const phases: PricePhase[] = PRICE_PHASES.map((p) => ({
  code: p.code,
  name: p.name,
  audience: p.audience,
  startsAt: local(p.startsAtLocal),
  endsAt: local(p.endsAtLocal),
  currency: "ARS",
  priority: p.priority,
  isActive: true,
  tiers: p.tiers.map((t) => ({ quantity: t.quantity, amountMinor: t.amountMinor })),
}));

const eligible: InterestEligibility = {
  benefitEligible: true,
  benefitDeadlineAt: BENEFIT_DEADLINE,
  active: true,
};
const notEligible: InterestEligibility = {
  benefitEligible: false,
  benefitDeadlineAt: null,
  active: true,
};

function priceAt(nowLocal: string, quantity: number, elig: InterestEligibility | null) {
  const r = resolvePrice({ now: local(nowLocal), quantity, phases, eligibility: elig });
  assert.equal(r.ok, true, `sin precio para ${nowLocal} x${quantity}`);
  return r.ok ? r.price : null!;
}

// Precio exclusivo para interesados (21/09 → 10/10).
assert.equal(priceAt("2026-09-21T00:00:00", 1, eligible).amountMinor, 4_500_000);
assert.equal(priceAt("2026-09-21T00:00:00", 2, eligible).amountMinor, 8_000_000);
assert.equal(priceAt("2026-09-21T00:00:00", 3, eligible).amountMinor, 10_000_000);
assert.equal(priceAt("2026-09-21T00:00:00", 1, eligible).isPromotional, true);

// Un usuario NO elegible en la misma fecha paga el precio general.
assert.equal(priceAt("2026-09-21T00:00:00", 1, notEligible).amountMinor, 5_000_000);
assert.equal(priceAt("2026-09-21T00:00:00", 1, notEligible).isPromotional, false);
// Un usuario anónimo tampoco accede al beneficio.
assert.equal(priceAt("2026-09-21T00:00:00", 1, null).amountMinor, 5_000_000);

// El promocional vence el 10/10 a las 23:59 de Argentina: exacto sigue vigente…
assert.equal(priceAt("2026-10-10T23:59:59", 1, eligible).amountMinor, 4_500_000);
assert.equal(priceAt("2026-10-10T23:59:59", 1, eligible).isPromotional, true);
// …y un segundo después, ya en el 11/10, el mismo usuario elegible paga el precio general.
const justAfterPromo = resolvePrice({
  now: new Date(local("2026-10-10T23:59:59").getTime() + 1000),
  quantity: 1,
  phases,
  eligibility: eligible,
});
assert.equal(justAfterPromo.ok, true);
assert.equal(justAfterPromo.ok && justAfterPromo.price.isPromotional, false);
assert.equal(justAfterPromo.ok && justAfterPromo.price.amountMinor, 5_000_000);
assert.equal(justAfterPromo.ok && justAfterPromo.price.phaseCode, "octubre");

// Precio de octubre (11 al 31).
assert.equal(priceAt("2026-10-11T00:00:00", 1, eligible).amountMinor, 5_000_000);
assert.equal(priceAt("2026-10-11T00:00:00", 1, eligible).isPromotional, false);
assert.equal(priceAt("2026-10-20T12:00:00", 2, null).amountMinor, 9_000_000);
assert.equal(priceAt("2026-10-31T23:59:59", 3, null).amountMinor, 11_500_000);

// Precio de noviembre.
assert.equal(priceAt("2026-11-01T00:00:00", 1, null).amountMinor, 6_000_000);
assert.equal(priceAt("2026-11-15T00:00:00", 2, null).amountMinor, 10_500_000);
assert.equal(priceAt("2026-11-30T23:59:59", 3, null).amountMinor, 13_500_000);

// Precio final de diciembre.
assert.equal(priceAt("2026-12-01T00:00:00", 1, null).amountMinor, 7_000_000);
assert.equal(priceAt("2026-12-05T23:59:59", 3, null).amountMinor, 15_000_000);

// Límites exactos entre etapas.
assert.equal(priceAt("2026-10-31T23:59:59", 1, null).phaseCode, "octubre");
assert.equal(priceAt("2026-11-01T00:00:00", 1, null).phaseCode, "noviembre");
assert.equal(priceAt("2026-11-30T23:59:59", 1, null).phaseCode, "noviembre");
assert.equal(priceAt("2026-12-01T00:00:00", 1, null).phaseCode, "diciembre");

// El huso horario importa: 2026-10-11T00:00 ART = 2026-10-11T03:00 UTC.
assert.equal(local("2026-10-11T00:00:00").toISOString(), "2026-10-11T03:00:00.000Z");
// A las 02:00 UTC del 11/10 en Argentina todavía es 10/10 23:00 → sigue el promocional.
const stillOctober10 = resolvePrice({
  now: new Date("2026-10-11T02:00:00.000Z"),
  quantity: 1,
  phases,
  eligibility: eligible,
});
assert.equal(stillOctober10.ok && stillOctober10.price.amountMinor, 4_500_000);

// Fuera de toda ventana no hay precio.
assert.equal(
  resolvePrice({ now: local("2026-09-20T12:00:00"), quantity: 1, phases, eligibility: eligible }).ok,
  false,
);
assert.equal(
  resolvePrice({ now: local("2026-12-06T00:00:00"), quantity: 1, phases, eligibility: null }).ok,
  false,
);

// Cantidad no ofrecida y cantidad inválida.
const q4 = resolvePrice({ now: local("2026-11-10T00:00:00"), quantity: 4, phases, eligibility: null });
assert.equal(q4.ok, false);
assert.equal(!q4.ok && q4.reason, "QUANTITY_NOT_OFFERED");
const q0 = resolvePrice({ now: local("2026-11-10T00:00:00"), quantity: 0, phases, eligibility: null });
assert.equal(!q0.ok && q0.reason, "INVALID_QUANTITY");

// El beneficio caduca por la fecha límite propia del interesado.
assert.equal(
  canUseInterestExclusivePhase(
    { benefitEligible: true, benefitDeadlineAt: local("2026-09-30T23:59:59"), active: true },
    local("2026-10-01T00:00:01"),
  ),
  false,
);
// Un interés cancelado no habilita el beneficio.
assert.equal(
  canUseInterestExclusivePhase({ ...eligible, active: false }, local("2026-09-25T00:00:00")),
  false,
);

// El servidor ignora un precio manipulado desde el cliente.
const serverPrice = priceAt("2026-11-10T00:00:00", 1, null);
assert.equal(assertClientAmountMatches(serverPrice, 1).ok, false);
assert.equal(assertClientAmountMatches(serverPrice, 6_000_000).ok, true);
assert.equal(assertClientAmountMatches(serverPrice, "6000000" as unknown).ok, false);
assert.equal(assertClientAmountMatches(serverPrice, 5_999_999.5).ok, false);

// Intl separa el símbolo del número con un espacio no separable; se normaliza
// cualquier espacio antes de comparar.
assert.equal(formatMinorAmount(4_500_000).replace(/\s/g, " "), "$ 45.000");

// ===========================================================================
// 5. Comunicaciones
// ===========================================================================
section("comunicaciones");

const baseRecipient: RecipientConsentState = {
  contestSpecificOptIn: true,
  generalOptIn: false,
  unsubscribedFromPromotional: false,
  isRegisteredParticipant: false,
};

const prodEnv = { environment: "production" as const, dnxPaymentsEnabled: false };
const devEnv = { environment: "development" as const, dnxPaymentsEnabled: false };

// Un concurso DRAFT no puede enviar emails reales.
const draftDispatch = decideDispatch({
  eventType: "INTEREST_CONFIRMED",
  contestStatus: "DRAFT",
  audience: "INTEREST_SPECIFIC",
  recipient: baseRecipient,
  env: prodEnv,
  mode: "LIVE",
  idempotencyKey: "k1",
});
assert.equal(draftDispatch.allowed, false);
assert.equal(!draftDispatch.allowed && draftDispatch.reason, "CONTEST_IN_DRAFT");

// …pero sí se puede previsualizar.
assert.equal(
  decideDispatch({
    eventType: "INTEREST_CONFIRMED",
    contestStatus: "DRAFT",
    audience: "INTEREST_SPECIFIC",
    recipient: baseRecipient,
    env: prodEnv,
    mode: "PREVIEW",
    idempotencyKey: "k1",
  }).allowed,
  true,
);

// Envío real bloqueado fuera de producción.
const devDispatch = decideDispatch({
  eventType: "INTEREST_CONFIRMED",
  contestStatus: "UPCOMING",
  audience: "INTEREST_SPECIFIC",
  recipient: baseRecipient,
  env: devEnv,
  mode: "LIVE",
  idempotencyKey: "k1",
});
assert.equal(!devDispatch.allowed && devDispatch.reason, "NON_PRODUCTION_ENVIRONMENT");

// Con concurso UPCOMING, consentimiento específico y producción: permitido.
assert.equal(
  decideDispatch({
    eventType: "INTEREST_CONFIRMED",
    contestStatus: "UPCOMING",
    audience: "INTEREST_SPECIFIC",
    recipient: baseRecipient,
    env: prodEnv,
    mode: "LIVE",
    idempotencyKey: "k1",
  }).allowed,
  true,
);

// Un mismo evento no genera emails duplicados.
const dup = decideDispatch({
  eventType: "INTEREST_CONFIRMED",
  contestStatus: "UPCOMING",
  audience: "INTEREST_SPECIFIC",
  recipient: baseRecipient,
  env: prodEnv,
  mode: "LIVE",
  idempotencyKey: "k1",
  alreadyDispatched: (k) => k === "k1",
});
assert.equal(!dup.allowed && dup.reason, "ALREADY_DISPATCHED");

// La clave de idempotencia es estable y discrimina por ocurrencia.
const kA = buildIdempotencyKey({ contestId: "c1", eventType: "PRELAUNCH_REMINDER", userId: 7, occurrence: "prelaunch-2026-09-14" });
const kB = buildIdempotencyKey({ contestId: "c1", eventType: "PRELAUNCH_REMINDER", userId: 7, occurrence: "prelaunch-2026-09-14" });
const kC = buildIdempotencyKey({ contestId: "c1", eventType: "PRELAUNCH_REMINDER", userId: 7, occurrence: "prelaunch-2026-09-19" });
assert.equal(kA, kB);
assert.notEqual(kA, kC);

// Usuarios dados de baja no reciben campañas promocionales.
const unsubscribed = { ...baseRecipient, unsubscribedFromPromotional: true };
const unsub = decideDispatch({
  eventType: "PROMO_PRICE_REMINDER",
  contestStatus: "UPCOMING",
  audience: "INTEREST_SPECIFIC",
  recipient: unsubscribed,
  env: prodEnv,
  mode: "LIVE",
  idempotencyKey: "k2",
});
assert.equal(!unsub.allowed && unsub.reason, "UNSUBSCRIBED");

// …pero las operativas de una participación confirmada sí llegan.
assert.equal(
  decideDispatch({
    eventType: "ADMISSION_CONFIRMED",
    contestStatus: "ADMISSION",
    audience: "REGISTERED_PARTICIPANTS",
    recipient: { ...unsubscribed, isRegisteredParticipant: true },
    env: prodEnv,
    mode: "LIVE",
    idempotencyKey: "k3",
  }).allowed,
  true,
  "las comunicaciones operativas no dependen del opt-in promocional",
);

// El consentimiento general es independiente del específico.
assert.equal(hasValidConsent("GENERAL_OPT_IN", "PROMOTIONAL", baseRecipient), false);
assert.equal(
  hasValidConsent("GENERAL_OPT_IN", "PROMOTIONAL", { ...baseRecipient, generalOptIn: true }),
  true,
);
// …y el general tampoco habilita por sí solo el específico de este concurso.
assert.equal(
  hasValidConsent("INTEREST_SPECIFIC", "PROMOTIONAL", {
    ...baseRecipient,
    contestSpecificOptIn: false,
    generalOptIn: true,
  }),
  false,
);

// Participar en otro concurso NO activa el consentimiento de éste.
const clickatonParticipant: RecipientConsentState = {
  contestSpecificOptIn: false,
  generalOptIn: false,
  unsubscribedFromPromotional: false,
  isRegisteredParticipant: true, // participante de otro concurso
};
const crossContest = decideDispatch({
  eventType: "PRELAUNCH_REMINDER",
  contestStatus: "UPCOMING",
  audience: "INTEREST_SPECIFIC",
  recipient: clickatonParticipant,
  env: prodEnv,
  mode: "LIVE",
  idempotencyKey: "k4",
});
assert.equal(!crossContest.allowed && crossContest.reason, "NO_VALID_CONSENT");

// Los eventos que dependen de pagos quedan bloqueados.
const payEvent = decideDispatch({
  eventType: "PAYMENT_CONFIRMED",
  contestStatus: "REGISTRATION_OPEN",
  audience: "REGISTERED_PARTICIPANTS",
  recipient: { ...baseRecipient, isRegisteredParticipant: true },
  env: prodEnv,
  mode: "LIVE",
  idempotencyKey: "k5",
});
assert.equal(!payEvent.allowed && payEvent.reason, "PAYMENTS_NOT_ENABLED");

// Resolución de entorno.
assert.equal(resolveDispatchEnvironment({ VERCEL_ENV: "production" }).environment, "production");
assert.equal(resolveDispatchEnvironment({ VERCEL_ENV: "preview" }).environment, "preview");
assert.equal(resolveDispatchEnvironment({ NODE_ENV: "test" }).environment, "test");
assert.equal(resolveDispatchEnvironment({}).environment, "development");
assert.equal(resolveDispatchEnvironment({}).dnxPaymentsEnabled, false);

// ===========================================================================
// 6. Gates de publicación
// ===========================================================================
section("gates de publicación");

// Snapshot real del concurso tal como lo deja el seed: falta casi todo.
const draftSnapshot: ContestGateSnapshot = {
  title: "El País que Miramos",
  shortDescription: "Ganá una cámara mirrorless",
  fullDescription: "Concurso Nacional de Fotografía",
  coverImageUrl: null, // imágenes todavía no cargadas
  organizationName: "FotoRank",
  timezone: TIMEZONE,
  interestBenefitCutoffAt: SCHEDULE_UTC.interestBenefitCutoffAt,
  benefitDeadlineAt: SCHEDULE_UTC.promoPriceEndsAt,
  consentVersion: CURRENT_CONSENT_VERSION,
  privacyPolicyUrl: null,
  interestConfirmationTemplateValidated: false,
  communicationsSafeModeConfigured: true,
  previewApprovedAt: null,
  organizerLegalName: null,
  organizerTaxId: null,
  organizerLegalAddress: null,
  organizerContactEmail: null,
  rulesPublishedVersionId: null,
  rulesLegalReviewApproved: false,
  judgesConfirmed: false,
  prize: PRIZE_SNAPSHOT,
  pricePhasesConfigured: true,
  // El concurso cobra a una sola cuenta: no reparte con nadie.
  paymentModel: "DIRECT",
  checkoutConfigured: false,
  dnxPaymentsEnabled: false,
  dnxSplitConfigValidated: false,
  cancellationAndRefundPolicyDefined: false,
  purchaseTestApproved: false,
  photoEnablementTestApproved: false,
  transactionalEmailsValidated: false,
  scheduleConsistent: true,
};

// El concurso NO puede pasar a UPCOMING: faltan imagen, política, preview y plantilla.
const upcomingGate = evaluateUpcomingGate(draftSnapshot);
assert.equal(upcomingGate.passed, false);
for (const label of [
  "Imagen de tarjeta",
  "Política de privacidad disponible",
  "Plantilla de confirmación validada",
  "Preview aprobado",
]) {
  assert.ok(upcomingGate.missing.includes(label), `debe faltar: ${label}`);
}

// Tampoco puede abrir inscripciones.
const openGate = evaluateRegistrationOpenGate(draftSnapshot);
assert.equal(openGate.passed, false);
for (const label of [
  "Datos legales completos del organizador",
  "Bases legales aprobadas",
  "Versión publicada de las bases",
  "Jurados confirmados",
  "Premio confirmado",
  "Modelo de cámara confirmado",
  "Checkout configurado",
]) {
  assert.ok(openGate.missing.includes(label), `debe faltar: ${label}`);
}

// Con cobro directo NO se exige nada de Split 1:N: sería un bloqueo sin sentido
// para un concurso donde organizador y receptor son la misma cuenta.
const directLabels = openGate.requirements.map((r) => r.label);
assert.equal(directLabels.includes("DNX Payments habilitado"), false);
assert.equal(directLabels.includes("Configuración split 1:N validada"), false);
assert.equal(directLabels.includes("Checkout configurado"), true);

// Un concurso que sí reparte con terceros vuelve a exigir Split 1:N.
const splitGate = evaluateRegistrationOpenGate({
  ...draftSnapshot,
  paymentModel: "SPLIT_1N",
});
const splitLabels = splitGate.requirements.map((r) => r.label);
assert.equal(splitLabels.includes("DNX Payments habilitado"), true);
assert.equal(splitLabels.includes("Configuración split 1:N validada"), true);
assert.equal(splitLabels.includes("Checkout configurado"), false);
assert.equal(splitGate.passed, false);

// Con el checkout configurado, ese requisito deja de faltar…
const withCheckout = evaluateRegistrationOpenGate({
  ...draftSnapshot,
  checkoutConfigured: true,
});
assert.equal(withCheckout.missing.includes("Checkout configurado"), false);
// …pero el resto de los bloqueos sigue en pie.
assert.equal(withCheckout.passed, false);

// El premio no está confirmado y se listan los campos faltantes.
assert.equal(isPrizeConfirmed(PRIZE_SNAPSHOT), false);
const missingPrize = listMissingPrizeFields(PRIZE_SNAPSHOT);
assert.ok(missingPrize.includes("Confirmación del modelo del premio"));
assert.ok(missingPrize.includes("Marca"));
assert.ok(missingPrize.includes("Garantía"));

// Un premio completo sí pasa.
assert.equal(
  isPrizeConfirmed({
    brand: "X",
    model: "Y",
    includedLens: "Z",
    isNewProduct: true,
    warranty: "12 meses",
    referenceValue: "ARS 1",
    supplier: "S",
    deliveryMethod: "Envío",
    shippingResponsible: "FotoRank",
    shippingCostCoverage: "Organizador",
    officialImageUrl: "https://example.test/a.jpg",
    outOfStockAlternative: "Equivalente superior",
    technicalSponsor: null,
    modelPendingConfirmation: false,
  }),
  true,
);

// La anulación administrativa deliberada existe y queda marcada como tal.
const overridden = evaluateUpcomingGate(draftSnapshot, { override: true });
assert.equal(overridden.passed, true);
assert.equal(overridden.overridden, true);
assert.ok(overridden.missing.length > 0, "el override no borra la lista de faltantes");

// ===========================================================================
// 7. Pagos diferidos
// ===========================================================================
section("pagos diferidos");

assert.equal(isDnxPaymentsEnabled({}), false);
assert.equal(isDnxPaymentsEnabled({ DNX_PAYMENTS_ENABLED: "1" }), true);
const payGuard = assertPaymentsAvailable({ contestStatus: "REGISTRATION_OPEN", env: {} });
assert.equal(payGuard.ok, false);
const payGuardDraft = assertPaymentsAvailable({
  contestStatus: "DRAFT",
  env: { DNX_PAYMENTS_ENABLED: "1" },
});
assert.equal(payGuardDraft.ok, false);

// ===========================================================================
// 8. Definición del concurso
// ===========================================================================
section("definición del concurso");

// Los criterios de evaluación suman 100.
assert.equal(
  EVALUATION_CRITERIA.reduce((acc, c) => acc + c.weightPercent, 0),
  100,
);

// Las bases están en borrador con marcadores legales sin completar.
assert.equal(contentHasLegalPlaceholder(EL_PAIS_QUE_MIRAMOS_RULES_DRAFT), true);
assert.ok(listLegalPlaceholders(EL_PAIS_QUE_MIRAMOS_RULES_DRAFT).length >= 10);
assert.ok(EL_PAIS_QUE_MIRAMOS_RULES_DRAFT.includes("PENDIENTE DE REVISIÓN LEGAL"));

// Las fechas clave se interpretan en hora de Argentina (UTC-3).
assert.equal(SCHEDULE_UTC.registrationOpensAt.toISOString(), "2026-09-21T03:00:00.000Z");
assert.equal(SCHEDULE_UTC.interestBenefitCutoffAt.toISOString(), "2026-09-21T02:59:59.000Z");
assert.equal(SCHEDULE_UTC.promoPriceEndsAt.toISOString(), "2026-10-11T02:59:59.000Z");
assert.equal(SCHEDULE_UTC.submissionsCloseAt.toISOString(), "2026-12-06T02:59:59.000Z");

// Cronograma consistente: cada hito es posterior al anterior.
const milestones = [
  SCHEDULE_UTC.interestBenefitCutoffAt,
  SCHEDULE_UTC.registrationOpensAt,
  SCHEDULE_UTC.promoPriceEndsAt,
  SCHEDULE_UTC.octoberPriceEndsAt,
  SCHEDULE_UTC.novemberPriceEndsAt,
  SCHEDULE_UTC.submissionsCloseAt,
  SCHEDULE_UTC.admissionStartAt,
  SCHEDULE_UTC.judgingStartAt,
  SCHEDULE_UTC.finalistsNotifiedAt,
  SCHEDULE_UTC.resultsAt,
];
for (let i = 1; i < milestones.length; i += 1) {
  assert.ok(
    milestones[i]!.getTime() > milestones[i - 1]!.getTime(),
    `hito ${i} no es posterior al anterior`,
  );
}

console.log(`upcoming.selfcheck.ts OK — ${checks.length} bloques: ${checks.join(", ")}`);
