export type MercadoPagoHttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface MercadoPagoRequestOptions {
  method: MercadoPagoHttpMethod;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  idempotencyKey?: string;
  correlationId?: string;
  /**
   * Cuando true, no envía x-test-token aunque el config sea sandbox.
   * Necesario para leer pagos Checkout Pro TEST que MP indexa fuera del
   * namespace x-test-token (live_mode reportado true con seller TEST).
   */
  skipTestToken?: boolean;
  /**
   * Token OAuth del collector beneficiario (Checkout Pro N=1).
   * No se loguea; reemplaza el Bearer del config para esta request.
   */
  accessTokenOverride?: string;
}
