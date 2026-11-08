/**
 * Marca del piloto dentro de `Order.pricingSnapshot`.
 *
 * El piloto no agrega columnas: la marca dice que el pedido se cobra por Split y guarda el
 * Order ID de Mercado Pago y el reparto. Así no hay migración que aplicar a mano en producción.
 */
/** EN_REVISION: Mercado Pago dejó el pago pendiente; no se puede volver a cobrar. */
export type EstadoPiloto = "PENDIENTE" | "EN_REVISION" | "ACREDITADA" | "PAGADO";

export type MarcaPiloto = {
  v: 1;
  estado: EstadoPiloto;
  providerOrderId?: string;
  reparto?: { fotografo: number; referidor: number; plataforma: number };
};

const CLAVE = "split1nPiloto";

function comoObjeto(snapshot: unknown): Record<string, unknown> {
  return snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
    ? (snapshot as Record<string, unknown>)
    : {};
}

export function leerMarcaPiloto(snapshot: unknown): MarcaPiloto | null {
  const marca = comoObjeto(snapshot)[CLAVE];
  if (!marca || typeof marca !== "object") return null;
  const m = marca as Partial<MarcaPiloto>;
  return m.v === 1 && typeof m.estado === "string" ? (m as MarcaPiloto) : null;
}

export function marcarSnapshotPiloto(
  snapshot: unknown,
  cambios: Omit<Partial<MarcaPiloto>, "v"> & { estado: EstadoPiloto },
): Record<string, unknown> {
  const base = comoObjeto(snapshot);
  const anterior = leerMarcaPiloto(base) ?? {};
  return { ...base, [CLAVE]: { ...anterior, ...cambios, v: 1 } };
}
