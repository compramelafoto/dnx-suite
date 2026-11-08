import {
  createMercadoPagoProviderConfig,
  MercadoPagoHttpClient,
  MercadoPagoOrdersAdapter,
  MercadoPagoSplitConsentAdapter,
} from "@repo/payments/mercado-pago";
import type { PilotoConfig } from "./config";

export class PilotoConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PilotoConfigError";
  }
}

/**
 * Clientes de Mercado Pago del piloto, con el token de la plataforma (app DNX Suite): la
 * plataforma es la cobradora y reparte. Mismo armado que la orden de cierre
 * (`lib/cierre-split-1n/create-production-order.ts`).
 */
export function crearClientesPiloto(config: PilotoConfig) {
  if (!config.accessToken || !config.ownerUserId) {
    throw new PilotoConfigError(
      "Faltan DNX_MP_PLATFORM_ACCESS_TOKEN o DNX_CLF_SPLIT_1N_PILOTO_OWNER_USER_ID.",
    );
  }
  const mpConfig = createMercadoPagoProviderConfig({
    accessToken: config.accessToken,
    environment: "production",
    ...(config.publicKey ? { publicKey: config.publicKey } : {}),
    allowProductionWrites: true,
  });
  const http = new MercadoPagoHttpClient(mpConfig);
  return {
    http,
    consents: new MercadoPagoSplitConsentAdapter({ config: mpConfig, httpClient: http }),
    orders: new MercadoPagoOrdersAdapter({
      config: mpConfig,
      ownerUserId: config.ownerUserId,
      httpClient: http,
      verifyAfterCreate: true,
      allowTestFixtures: false,
      enforceOrders1nStagingGate: false,
      defaultStatementDescriptor: "CLF FOTOS",
    }),
  };
}

/** La orden tal como la devuelve Mercado Pago, sólo con lo que usa el piloto. */
export type OrdenMpLeida = {
  id: string;
  status: string | null;
  statusDetail: string | null;
  externalReference: string | null;
  paymentId: string | null;
};

type OrdenMpCruda = {
  id?: string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  transactions?: { payments?: Array<{ id?: string }> };
};

/**
 * GET crudo de la orden. El adaptador no expone `external_reference`, y sin ella no se puede
 * comprobar que la orden sea de este pedido.
 */
export async function leerOrdenMp(
  http: MercadoPagoHttpClient,
  providerOrderId: string,
): Promise<OrdenMpLeida> {
  const res = await http.request<OrdenMpCruda>({
    method: "GET",
    path: `/v1/orders/${encodeURIComponent(providerOrderId)}`,
  });
  const body = res.body ?? {};
  return {
    id: body.id ?? providerOrderId,
    status: body.status ?? null,
    statusDetail: body.status_detail ?? null,
    externalReference: body.external_reference ?? null,
    paymentId: body.transactions?.payments?.[0]?.id ?? null,
  };
}
