export type MercadoPagoHttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface MercadoPagoRequestOptions {
  method: MercadoPagoHttpMethod;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  idempotencyKey?: string;
  correlationId?: string;
}
