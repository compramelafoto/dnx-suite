/**
 * Emite el payload del POST /v1/orders tal como lo arma la integración, con los
 * datos sensibles enmascarados.
 *
 * Mercado Pago lo pidió en la revisión del 07/10/2026 (IXFS-16376) porque la
 * Orders API **no devuelve `payer` en el GET**: la orden responde `payer: null`,
 * así que el payload de creación es la única forma de evidenciar el email y los
 * datos del pagador.
 *
 * No toca la red ni necesita credenciales: usa el mismo constructor que el
 * camino real, con valores de ejemplo.
 *
 * Uso:
 *   pnpm --filter @repo/payments exec tsx src/cli/imp05-sanitized-payload.ts
 */
import { money } from "../money/index.js";
import { calculateDistribution } from "../distribution/calculate.js";
import {
  buildMercadoPagoSplitOrderRequest,
  buildSplitEntriesFromDistribution,
  resolveMpAmountType,
} from "../providers/mercado-pago/orders/mapper.js";
import { singleIntangibleItem } from "../providers/mercado-pago/orders/order-items.js";
import { testActivePartnerConsent } from "../providers/mercado-pago/orders/consent-evidence.js";

const OWNER = "3141372692";
const PARTNER_A = "00000000-0000-4000-8000-00000000000a";
const PARTNER_B = "00000000-0000-4000-8000-00000000000b";

/** Deja ver la forma del dato sin exponerlo. */
function mask(value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (value.includes("@")) {
    const [user, domain] = value.split("@");
    return `${user.slice(0, 2)}…@${domain}`;
  }
  return value.length > 10 ? `${value.slice(0, 8)}…` : value;
}

function sanitize(body: Record<string, unknown>): Record<string, unknown> {
  const out = structuredClone(body) as Record<string, any>;
  if (out.payer?.email) out.payer.email = mask(out.payer.email);
  for (const s of out.splits ?? []) {
    if (s.receiver_type === "partner") s.receiver_id = mask(s.receiver_id);
  }
  for (const p of out.transactions?.payments ?? []) {
    if (p.payment_method?.token) p.payment_method.token = "«card_token»";
  }
  return out;
}

export function buildSanitizedHomologationPayload(): Record<string, unknown> {
  const total = money("ARS", 15_000n);
  const distribution = calculateDistribution({
    total,
    rules: [
      { recipientId: "owner-share", role: "PLATFORM", kind: "PERCENTAGE", percentageBps: 8000, priority: 1, optional: false },
      { recipientId: "partner-a", role: "PHOTOGRAPHER", kind: "PERCENTAGE", percentageBps: 1000, priority: 2, optional: false },
      { recipientId: "partner-b", role: "ORGANIZER", kind: "PERCENTAGE", percentageBps: 1000, priority: 3, optional: false },
    ],
    rounding: "LARGEST_REMAINDER",
    eligibleRecipientIds: ["owner-share", "partner-a", "partner-b"],
  });
  const partnerReceiverIds = new Map([
    ["partner-a", PARTNER_A],
    ["partner-b", PARTNER_B],
  ]);
  const amountType = resolveMpAmountType(distribution, "fixed_preferred");
  const entries = buildSplitEntriesFromDistribution(distribution, OWNER, partnerReceiverIds, {
    partnerConsentsByRecipientId: new Map([
      ["partner-a", testActivePartnerConsent(PARTNER_A)],
      ["partner-b", testActivePartnerConsent(PARTNER_B)],
    ]),
    amountType,
  });

  const built = buildMercadoPagoSplitOrderRequest({
    externalReference: "clf-hg-owner-plus-2-ejemplo",
    total,
    amountType,
    entries,
    deviceSessionId: "armor.«device_id»",
    payerEmail: "buyer.imp05@testuser.com",
    payerProfile: {
      firstName: "Comprador",
      lastName: "De Prueba",
      identification: { type: "DNI", number: "12345678" },
      phone: { areaCode: "341", number: "5550000" },
      address: {
        zipCode: "2000",
        streetName: "Córdoba",
        streetNumber: "1234",
        neighborhood: "Centro",
        city: "Rosario",
      },
      registrationDate: "2024-01-15T10:00:00.000-03:00",
      isPrimeUser: false,
      isFirstPurchaseOnline: true,
      authenticationType: "WEB",
      lastPurchase: "2026-09-01T10:00:00.000-03:00",
    },
    statementDescriptor: "DNX TEST",
    items: [
      singleIntangibleItem({
        title: "Foto digital en alta resolución",
        total,
        categoryId: "virtual_goods",
        externalCode: "CLF-FOTO-001",
      }),
    ],
    paymentToken: "«card_token»",
    paymentMethodId: "master",
    installments: 1,
  });

  return sanitize(built.body as Record<string, unknown>);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(buildSanitizedHomologationPayload(), null, 2));
}
