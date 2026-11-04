import { randomUUID } from "node:crypto";
import { money } from "@repo/payments/money";
import { calculateDistribution } from "@repo/payments/distribution";
import {
  assertLiveCollectorAccount,
  createMercadoPagoProviderConfig,
  MercadoPagoHttpClient,
  MercadoPagoOrdersAdapter,
  MercadoPagoSplitConsentAdapter,
  singleIntangibleItem,
} from "@repo/payments/mercado-pago";
import {
  pagadorTambienRecibe,
  REPARTO_BPS,
  resolveCierreConfig,
  type CierreConfig,
} from "./config";
import { escribirEvidenciaCierre } from "./evidencia";

export type CrearOrdenCierreInput = {
  cardToken: string;
  paymentMethodId: string;
  installments: number;
  deviceSessionId: string;
  payerEmail: string;
  payerIdentification?: { type: string; number: string };
};

export type CrearOrdenCierreResult = {
  /** Entero, no prefijo: es el dato que hay que mandarle a Mercado Pago. */
  providerOrderId: string;
  status: string;
  statusDetail: string | null;
  liveMode: boolean | null;
  receptores: number;
  splitSumValid: boolean;
  totalMinor: string;
  evidenciaPath: string | null;
};

export class CierreOrdenError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "CierreOrdenError";
  }
}

/**
 * Comprueba que los dos partners tengan consentimiento **ACTIVE de verdad**.
 *
 * La superficie de homologación daba el consentimiento por sentado (lo forzaba con
 * `x-test-status`, que solo existe en sandbox). Acá no se puede ni se debe: si un partner
 * no aceptó, Mercado Pago rechaza la orden y el cobro queda a medias. Preguntarlo antes
 * cuesta una llamada y evita un pago fallido con dinero real.
 */
async function verificarConsentimientos(
  adapter: MercadoPagoSplitConsentAdapter,
  receivers: string[],
): Promise<string[]> {
  const consultas = await Promise.all(
    receivers.map(async (receiverId) => ({
      receiverId,
      consent: await adapter.getConsent(receiverId),
    })),
  );

  const faltantes = consultas.filter((c) => c.consent?.status !== "ACTIVE");
  if (faltantes.length > 0) {
    const detalle = faltantes
      .map((f) => `${f.receiverId.slice(0, 8)}…=${f.consent?.status ?? "NO_EXISTE"}`)
      .join(", ");
    throw new CierreOrdenError(
      "CONSENTIMIENTO_NO_ACTIVO",
      `Falta que acepten el consentimiento: ${detalle}. La orden no se crea hasta que los dos estén ACTIVE.`,
    );
  }

  // Los correos de los receptores salen de la consulta, no de nuestra base: son los que
  // Mercado Pago tiene asociados al consentimiento.
  return consultas.map((c) => (c.consent?.sellerEmail ?? "").toLowerCase());
}

/**
 * Identifica la cuenta cobradora y frena si no es real.
 *
 * Cumple dos cosas de un saque:
 *
 * 1. **Rechaza las cuentas de prueba.** El prefijo `APP_USR-` no las distingue de las
 *    productivas, así que el control por el texto del token no alcanza. El 2026-11-02 una
 *    invitación al consentimiento falló con 403 por este motivo y el 403 se confundió con
 *    una falta de permisos de Mercado Pago. Ver `live-account-guard.ts`.
 *
 * 2. **Devuelve el correo del owner**, que también recibe parte del reparto. El
 *    consentimiento no lo cubre —el owner no se consiente a sí mismo— y es justamente la
 *    colisión más probable, porque lo natural es que pague quien opera la pantalla.
 *
 * Falla cerrado. Antes esta consulta fallaba abierta para que un hipo de red no frenara una
 * operación correcta; ahora frena, porque lo que está en juego ya no es un aviso de cortesía
 * sino saber con qué cuenta se está por cobrar dinero real.
 */


/**
 * Crea la orden productiva de cierre: owner + 2 partners, dinero real.
 *
 * No crea venta de CLF, no habilita descargas, no manda correos y no toca Checkout Pro.
 * Lo único que produce es el Order ID que pide Mercado Pago.
 */
export async function crearOrdenCierreProduccion(
  input: CrearOrdenCierreInput,
): Promise<CrearOrdenCierreResult> {
  const resolved = resolveCierreConfig();
  if (!resolved.ok) {
    throw new CierreOrdenError(resolved.error.code, resolved.error.message);
  }
  const config: CierreConfig = resolved.config;

  const device = input.deviceSessionId.trim();
  if (!device) {
    throw new CierreOrdenError(
      "DEVICE_SESSION_REQUIRED",
      "Esperá a que el formulario inicialice la sesión de seguridad.",
    );
  }
  const token = input.cardToken.trim();
  if (!token) {
    throw new CierreOrdenError("CARD_TOKEN_REQUIRED", "Falta el token de la tarjeta.");
  }

  const mpConfig = createMercadoPagoProviderConfig({
    accessToken: config.accessToken,
    environment: "production",
    publicKey: config.publicKey,
    // Segundo freno, el del cliente HTTP. Sin esto toda escritura productiva se rechaza.
    allowProductionWrites: true,
  });
  const http = new MercadoPagoHttpClient(mpConfig);

  // Primero quién cobra: si la credencial no es de una cuenta real, no tiene sentido
  // consultar consentimientos ni cobrar nada.
  const cuentaCobradora = await assertLiveCollectorAccount(http);

  const correosReceptores = await verificarConsentimientos(
    new MercadoPagoSplitConsentAdapter({ config: mpConfig, httpClient: http }),
    [config.receiverA, config.receiverB],
  );
  const payerEmail = config.payerEmailOverride ?? input.payerEmail;
  const correoOwner = cuentaCobradora.email?.trim().toLowerCase() ?? null;
  if (correoOwner) correosReceptores.push(correoOwner);
  if (pagadorTambienRecibe(payerEmail, correosReceptores)) {
    throw new CierreOrdenError(
      "PAGADOR_ES_RECEPTOR",
      "Quien paga también recibe parte del reparto. Mercado Pago pide un tercero con tarjeta propia: declaralo en DNX_CLF_SPLIT_1N_CIERRE_PAYER_EMAIL.",
    );
  }

  const total = money("ARS", config.totalMinor);
  const rules = [
    {
      recipientId: "owner",
      role: "OTHER" as const,
      kind: "PERCENTAGE" as const,
      percentageBps: REPARTO_BPS.owner,
      priority: 1,
      optional: false,
    },
    {
      recipientId: "fotografo",
      role: "OTHER" as const,
      kind: "PERCENTAGE" as const,
      percentageBps: REPARTO_BPS.fotografo,
      priority: 2,
      optional: false,
    },
    {
      recipientId: "referidor",
      role: "OTHER" as const,
      kind: "PERCENTAGE" as const,
      percentageBps: REPARTO_BPS.referidor,
      priority: 3,
      optional: false,
    },
  ];

  const distribution = calculateDistribution({
    total,
    rules,
    rounding: "LARGEST_REMAINDER",
    eligibleRecipientIds: rules.map((r) => r.recipientId),
  });
  const suma = distribution.entries.reduce(
    (acc, e) => acc + e.amount.amountMinor,
    BigInt(0),
  );
  const splitSumValid = suma === config.totalMinor;
  if (!splitSumValid) {
    // Si el reparto no suma el total, Mercado Pago lo rechaza. Mejor frenar antes de cobrar.
    throw new CierreOrdenError(
      "REPARTO_NO_SUMA",
      "El reparto no suma el total. No se crea la orden.",
    );
  }

  const partnerReceiverIds = new Map<string, string>([
    ["fotografo", config.receiverA],
    ["referidor", config.receiverB],
  ]);
  const partnerConsentsByRecipientId = new Map(
    [...partnerReceiverIds.entries()].map(([recipientId, receiverId]) => [
      recipientId,
      { receiverId, status: "ACTIVE" as const, provider: "mercadopago" as const },
    ]),
  );

  const adapter = new MercadoPagoOrdersAdapter({
    config: mpConfig,
    ownerUserId: config.ownerUserId,
    httpClient: http,
    verifyAfterCreate: true,
    allowTestFixtures: false,
    enforceOrders1nStagingGate: false,
    defaultStatementDescriptor: "CLF FOTOS",
  });

  const externalReference = `clf-cierre-1n-${randomUUID().slice(0, 8)}`;
  const created = await adapter.createSplitOrder({
    environment: "production",
    externalReference,
    total,
    distribution,
    idempotencyKey: randomUUID(),
    deviceSessionId: device,
    paymentToken: token,
    paymentMethodId: input.paymentMethodId || "master",
    installments: input.installments || 1,
    payerEmail,
    ...(input.payerIdentification
      ? { payerProfile: { identification: input.payerIdentification } }
      : {}),
    statementDescriptor: "CLF FOTOS",
    items: [
      singleIntangibleItem({
        title: "Foto digital",
        total,
        categoryId: "virtual_goods",
      }),
    ],
    partnerReceiverIds,
    partnerConsentsByRecipientId,
    metadata: {
      source: "CLF_CIERRE_SPLIT_1N_PRODUCCION",
      externalReference,
    },
  });

  const got = await adapter.getOrder(created.providerOrderId, "production");
  const liveMode =
    typeof (got as { liveMode?: unknown }).liveMode === "boolean"
      ? ((got as { liveMode?: boolean }).liveMode ?? null)
      : null;

  const evidenciaPath = escribirEvidenciaCierre({
    providerOrderId: created.providerOrderId,
    externalReference,
    status: got.status,
    statusDetail: got.statusDetail ?? null,
    liveMode,
    totalMinor: config.totalMinor.toString(),
    currency: "ARS",
    receptores: 3,
    repartoBps: REPARTO_BPS,
    splitSumValid,
    deviceSessionIdLength: device.length,
    creadoEn: new Date().toISOString(),
  });

  console.info(
    JSON.stringify({
      event: "CLF_CIERRE_SPLIT_1N",
      ORDER_CREATED: true,
      ORDER_STATUS: got.status,
      LIVE_MODE: liveMode,
      RECEIVER_COUNT: 3,
      SPLIT_SUM_VALID: splitSumValid,
      externalReference,
      // nunca token, ni device completo, ni correos
    }),
  );

  return {
    providerOrderId: created.providerOrderId,
    status: got.status,
    statusDetail: got.statusDetail ?? null,
    liveMode,
    receptores: 3,
    splitSumValid,
    totalMinor: config.totalMinor.toString(),
    evidenciaPath,
  };
}
