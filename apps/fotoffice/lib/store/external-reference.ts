import { STORE_EXTERNAL_REFERENCE_PREFIX } from "./constants";

export function storeExternalReference(orderId: string): string {
  return `${STORE_EXTERNAL_REFERENCE_PREFIX}${orderId}`;
}

/** El id de pedido que viaja en un aviso de Mercado Pago, o null si el pago es de otra cosa. */
export function parseStoreExternalReference(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith(STORE_EXTERNAL_REFERENCE_PREFIX)) return null;
  const id = raw.slice(STORE_EXTERNAL_REFERENCE_PREFIX.length).trim();
  return id.length > 0 ? id : null;
}
