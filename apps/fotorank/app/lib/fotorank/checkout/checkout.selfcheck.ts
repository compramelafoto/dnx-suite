/**
 * Selfcheck del checkout de FotoRank (Checkout Pro, cobro directo sin split).
 *
 * Lógica pura, sin base de datos ni red.
 * Uso: pnpm --filter fotorank test:checkout:selfcheck
 */
import assert from "node:assert/strict";

import {
  CheckoutMoneyError,
  formatArs,
  minorToWholeUnits,
  paidAmountMatches,
  wholeUnitsToMinor,
} from "./money";
import {
  checkConfigReadiness,
  isTestAccessToken,
  loadCheckoutConfig,
} from "./config";
import { decideCheckout, shouldReusePendingRegistration } from "./policy";
import { assertPreferenceChargesExpected, buildPreferenceBody } from "./preference";
import { buildPaymentEventKey, decideWebhookOutcome } from "./webhook-policy";

const checks: string[] = [];
const section = (n: string) => checks.push(n);

// ===========================================================================
// 1. Conversión de unidades — el punto de fricción de factor 100
// ===========================================================================
section("dinero");

// Los precios reales del concurso convierten exacto.
assert.equal(minorToWholeUnits(4_500_000), 45_000);
assert.equal(minorToWholeUnits(8_000_000), 80_000);
assert.equal(minorToWholeUnits(10_000_000), 100_000);
assert.equal(minorToWholeUnits(15_000_000), 150_000);

// Un importe con centavos NO se trunca en silencio: rompe.
assert.throws(() => minorToWholeUnits(4_500_050), (e: unknown) => {
  return e instanceof CheckoutMoneyError && e.code === "AMOUNT_HAS_CENTS";
});
assert.throws(() => minorToWholeUnits(0), (e: unknown) => {
  return e instanceof CheckoutMoneyError && e.code === "AMOUNT_NOT_POSITIVE";
});
assert.throws(() => minorToWholeUnits(-100), (e: unknown) => {
  return e instanceof CheckoutMoneyError && e.code === "AMOUNT_NOT_POSITIVE";
});
assert.throws(() => minorToWholeUnits(1.5), (e: unknown) => {
  return e instanceof CheckoutMoneyError && e.code === "AMOUNT_NOT_INTEGER";
});

// Ida y vuelta estable.
assert.equal(wholeUnitsToMinor(45_000), 4_500_000);
assert.equal(wholeUnitsToMinor(45_000.0), 4_500_000);
assert.equal(minorToWholeUnits(wholeUnitsToMinor(115_000)), 115_000);

// Comparación de importes con tolerancia cero.
assert.equal(paidAmountMatches({ expectedMinor: 4_500_000, paidAmountFromProvider: 45_000 }).ok, true);
const mismatch = paidAmountMatches({ expectedMinor: 4_500_000, paidAmountFromProvider: 450 });
assert.equal(mismatch.ok, false);
assert.equal(!mismatch.ok && mismatch.paidMinor, 45_000);
// Un peso de diferencia también es discrepancia.
assert.equal(
  paidAmountMatches({ expectedMinor: 4_500_000, paidAmountFromProvider: 44_999 }).ok,
  false,
);

assert.equal(formatArs(4_500_000).replace(/\s/g, " "), "$ 45.000");

// ===========================================================================
// 2. Configuración — falla cerrado
// ===========================================================================
section("configuración");

// Sin el flag, nada opera.
const off = checkConfigReadiness({});
assert.equal(off.ready, false);
assert.equal(!off.ready && off.missing.includes("FOTORANK_CHECKOUT_ENABLED"), true);

// Con el flag pero sin credenciales, se listan las que faltan.
const partial = checkConfigReadiness({ FOTORANK_CHECKOUT_ENABLED: "1" });
assert.equal(partial.ready, false);
assert.equal(!partial.ready && partial.missing.includes("FOTORANK_MP_ACCESS_TOKEN"), true);
assert.equal(!partial.ready && partial.missing.includes("FOTORANK_MP_WEBHOOK_SECRET"), true);
assert.equal(!partial.ready && partial.missing.includes("FOTORANK_PUBLIC_URL"), true);

const fullEnv = {
  FOTORANK_CHECKOUT_ENABLED: "1",
  FOTORANK_MP_ACCESS_TOKEN: "APP_USR-xxx",
  FOTORANK_MP_WEBHOOK_SECRET: "s3cr3t",
  FOTORANK_PUBLIC_URL: "https://fotorank.test",
};
assert.equal(checkConfigReadiness(fullEnv).ready, true);

// Una credencial de prueba en producción se rechaza: el cobro no sería real.
const testInProd = checkConfigReadiness({
  ...fullEnv,
  FOTORANK_MP_ACCESS_TOKEN: "TEST-abc",
  VERCEL_ENV: "production",
});
assert.equal(testInProd.ready, false);
assert.equal(!testInProd.ready && testInProd.reason.includes("prueba"), true);

// La misma credencial de prueba sí sirve fuera de producción.
assert.equal(
  checkConfigReadiness({ ...fullEnv, FOTORANK_MP_ACCESS_TOKEN: "TEST-abc" }).ready,
  true,
);

assert.equal(isTestAccessToken("TEST-abc"), true);
assert.equal(isTestAccessToken("APP_USR-abc"), false);
assert.equal(isTestAccessToken(null), false);
assert.equal(loadCheckoutConfig({}).enabled, false);
// El entorno se deriva de VERCEL_ENV; por defecto nunca es producción.
assert.equal(loadCheckoutConfig({}).environment, "sandbox");
assert.equal(loadCheckoutConfig({ VERCEL_ENV: "production" }).environment, "production");

// ===========================================================================
// 3. Política de checkout
// ===========================================================================
section("política");

const OPENS = new Date("2026-09-21T03:00:00.000Z");
const CLOSES = new Date("2026-12-06T02:59:59.000Z");

const basePolicy = {
  now: new Date("2026-10-01T12:00:00.000Z"),
  contestStatus: "REGISTRATION_OPEN",
  configReady: true,
  registrationOpensAt: OPENS,
  registrationClosesAt: CLOSES,
  quantity: 1,
  maxPhotosPerParticipant: 3,
  existingRegistrationStatus: "NONE" as const,
};

assert.equal(decideCheckout(basePolicy).allowed, true);

// Sin configuración no se cobra, aunque el concurso esté abierto.
const noConfig = decideCheckout({ ...basePolicy, configReady: false });
assert.equal(noConfig.allowed, false);
assert.equal(!noConfig.allowed && noConfig.reason, "CHECKOUT_NOT_CONFIGURED");

// En cualquier fase que no sea REGISTRATION_OPEN, no se cobra.
for (const status of ["DRAFT", "UPCOMING", "SUBMISSIONS_CLOSED", "JUDGING", "COMPLETED", "CANCELLED"]) {
  const d = decideCheckout({ ...basePolicy, contestStatus: status });
  assert.equal(d.allowed, false, `${status} no debe permitir cobro`);
  assert.equal(!d.allowed && d.reason, "CONTEST_NOT_OPEN");
}

// Ventana de inscripción, con límites exactos.
assert.equal(decideCheckout({ ...basePolicy, now: OPENS }).allowed, true);
assert.equal(decideCheckout({ ...basePolicy, now: CLOSES }).allowed, true);
assert.equal(
  decideCheckout({ ...basePolicy, now: new Date(OPENS.getTime() - 1) }).allowed,
  false,
);
assert.equal(
  decideCheckout({ ...basePolicy, now: new Date(CLOSES.getTime() + 1) }).allowed,
  false,
);

// Cantidad de fotografías: 1 a 3.
for (const q of [1, 2, 3]) {
  assert.equal(decideCheckout({ ...basePolicy, quantity: q }).allowed, true);
}
for (const q of [0, 4, -1, 1.5]) {
  const d = decideCheckout({ ...basePolicy, quantity: q });
  assert.equal(d.allowed, false, `cantidad ${q} debe rechazarse`);
  assert.equal(!d.allowed && d.reason, "INVALID_QUANTITY");
}

// Una inscripción confirmada bloquea; una pendiente permite reintentar.
const already = decideCheckout({ ...basePolicy, existingRegistrationStatus: "CONFIRMED" });
assert.equal(!already.allowed && already.reason, "ALREADY_REGISTERED");
assert.equal(
  decideCheckout({ ...basePolicy, existingRegistrationStatus: "PENDING_PAYMENT" }).allowed,
  true,
);
assert.equal(shouldReusePendingRegistration("PENDING_PAYMENT"), true);
assert.equal(shouldReusePendingRegistration("CONFIRMED"), false);

// ===========================================================================
// 4. Preference
// ===========================================================================
section("preference");

const pref = buildPreferenceBody({
  externalReference: "fr-reg-abc123",
  contestId: "contest_1",
  contestTitle: "El País que Miramos",
  quantity: 3,
  totalAmountMinor: 10_000_000,
  pricePhaseCode: "interest-exclusive",
  participantUserId: 42,
  publicUrl: "https://fotorank.test/",
});

// Una sola línea con el precio del paquete: NO se divide entre 3.
assert.equal(pref.items.length, 1);
assert.equal(pref.items[0]!.quantity, 1);
assert.equal(pref.items[0]!.unit_price, 100_000);
assert.equal(pref.items[0]!.currency_id, "ARS");
assert.equal(pref.items[0]!.description, "Participación con 3 fotografías");

// Sin split: no hay marketplace_fee ni receivers.
assert.equal("marketplace_fee" in pref, false);
assert.equal("receivers" in pref, false);
assert.equal("splits" in pref, false);

// La barra final de la URL pública no se duplica.
assert.equal(pref.notification_url, "https://fotorank.test/api/payments/mercadopago/webhook");
assert.ok(pref.back_urls.success.startsWith("https://fotorank.test/concursos/pago/exito"));
assert.equal(pref.external_reference, "fr-reg-abc123");
assert.equal(pref.auto_return, "approved");

// El metadata es trazabilidad interna, sin datos personales.
assert.equal(pref.metadata.price_phase, "interest-exclusive");
assert.equal(pref.metadata.amount_minor, 10_000_000);
assert.equal("email" in pref.metadata, false);
assert.equal("payer" in pref, false);

// El email del pagador sólo se incluye si se provee.
const withPayer = buildPreferenceBody({
  externalReference: "fr-reg-x",
  contestId: "c",
  contestTitle: "T",
  quantity: 1,
  totalAmountMinor: 4_500_000,
  pricePhaseCode: "octubre",
  participantUserId: 1,
  participantEmail: "participante@example.test",
  publicUrl: "https://fotorank.test",
});
assert.equal(withPayer.payer?.email, "participante@example.test");

// Última barrera: la preference debe cobrar exactamente lo calculado.
assertPreferenceChargesExpected(pref, 10_000_000);
assert.throws(() => assertPreferenceChargesExpected(pref, 9_999_900));

// Un precio con centavos no puede llegar a una preference.
assert.throws(() =>
  buildPreferenceBody({
    externalReference: "fr-reg-y",
    contestId: "c",
    contestTitle: "T",
    quantity: 1,
    totalAmountMinor: 4_500_055,
    pricePhaseCode: "octubre",
    participantUserId: 1,
    publicUrl: "https://fotorank.test",
  }),
);

// ===========================================================================
// 5. Webhook
// ===========================================================================
section("webhook");

const baseHook = {
  status: "approved" as const,
  paidAmountFromProvider: 45_000,
  expectedMinor: 4_500_000,
  liveMode: false,
  environment: "sandbox" as const,
  alreadyProcessed: false,
};

// Pago aprobado con importe correcto: se confirma.
const confirm = decideWebhookOutcome(baseHook);
assert.equal(confirm.action, "CONFIRM");
assert.equal(confirm.action === "CONFIRM" && confirm.paidMinor, 4_500_000);

// Aprobado pero con importe distinto: NO se confirma.
const flagged = decideWebhookOutcome({ ...baseHook, paidAmountFromProvider: 450 });
assert.equal(flagged.action, "FLAG_MISMATCH");

// Aprobado sin importe informado: tampoco se confirma.
assert.equal(
  decideWebhookOutcome({ ...baseHook, paidAmountFromProvider: null }).action,
  "FLAG_MISMATCH",
);

// Idempotencia: un reintento de MP no repite efectos.
assert.equal(decideWebhookOutcome({ ...baseHook, alreadyProcessed: true }).action, "DUPLICATE");

// Guardas de entorno cruzadas.
assert.equal(
  decideWebhookOutcome({ ...baseHook, liveMode: true, environment: "sandbox" }).action,
  "REJECT",
);
assert.equal(
  decideWebhookOutcome({ ...baseHook, liveMode: false, environment: "production" }).action,
  "REJECT",
);
// Producción con pago real sí confirma.
assert.equal(
  decideWebhookOutcome({ ...baseHook, liveMode: true, environment: "production" }).action,
  "CONFIRM",
);

// Resto de estados.
assert.equal(decideWebhookOutcome({ ...baseHook, status: "pending" }).action, "KEEP_PENDING");
assert.equal(decideWebhookOutcome({ ...baseHook, status: "in_process" }).action, "KEEP_PENDING");
assert.equal(decideWebhookOutcome({ ...baseHook, status: "rejected" }).action, "MARK_FAILED");
assert.equal(decideWebhookOutcome({ ...baseHook, status: "cancelled" }).action, "MARK_FAILED");
assert.equal(decideWebhookOutcome({ ...baseHook, status: "refunded" }).action, "REVERSE");
assert.equal(decideWebhookOutcome({ ...baseHook, status: "charged_back" }).action, "REVERSE");
// Un estado desconocido nunca confirma.
assert.equal(decideWebhookOutcome({ ...baseHook, status: "lo_que_sea" }).action, "KEEP_PENDING");

// La clave de idempotencia es estable y discrimina por estado.
const k1 = buildPaymentEventKey({ providerPaymentId: "123", status: "approved" });
assert.equal(k1, buildPaymentEventKey({ providerPaymentId: "123", status: "approved" }));
assert.notEqual(k1, buildPaymentEventKey({ providerPaymentId: "123", status: "refunded" }));

console.log(`checkout.selfcheck.ts OK — ${checks.length} bloques: ${checks.join(", ")}`);
