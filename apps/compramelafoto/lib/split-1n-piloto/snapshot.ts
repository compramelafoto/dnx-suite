/**
 * Marca del piloto dentro de `Order.pricingSnapshot`.
 *
 * El piloto no agrega columnas: la marca dice que el pedido se cobra por Split y guarda el
 * Order ID de Mercado Pago y el reparto. Así no hay migración que aplicar a mano en producción.
 */
/**
 * - COBRANDO: hay un pedido a Mercado Pago en curso o con resultado incierto. Nadie más cobra.
 * - EN_REVISION: Mercado Pago dejó el pago pendiente; no se puede volver a cobrar.
 * - CHECKOUT_PRO: el comprador eligió «Pagar con Mercado Pago» (plan B). La tarjeta ya no cobra
 *   este pedido y Checkout Pro sí: es el único estado del piloto que lo admite.
 */
export type EstadoPiloto =
  | "PENDIENTE"
  | "COBRANDO"
  | "EN_REVISION"
  | "ACREDITADA"
  | "PAGADO"
  | "CHECKOUT_PRO";

export type MarcaPiloto = {
  v: 1;
  estado: EstadoPiloto;
  providerOrderId?: string;
  /** Intento de cobro vigente: arma la clave de idempotencia. */
  intento?: number;
  /** Usuario de CLF que cobró como referidor por el split: su comisión nace pagada. */
  referidorUserId?: number | null;
  /** Organizador que cobró su comisión por el split: se registra como cobrada directo. */
  organizadorUserId?: number | null;
  /** Referidor del organizador que cobró por el split: su comisión nace pagada. */
  referidorOrganizadorUserId?: number | null;
  reparto?: {
    fotografo: number;
    referidor: number;
    plataforma: number;
    organizador?: number;
    referidorOrganizador?: number;
  };
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

/**
 * ¿Hay que negarle Checkout Pro a este pedido? Sí, si es del piloto y no eligió el plan B: su
 * cobro va por tarjeta y puede estar en curso. Crear otro cobro acá es cobrar dos veces.
 */
export function bloqueaCheckoutPro(snapshot: unknown): boolean {
  const marca = leerMarcaPiloto(snapshot);
  return marca != null && marca.estado !== "CHECKOUT_PRO";
}

/** ¿El cobro con tarjeta está en curso, en revisión o hecho? (No se le pide que pague otra vez.) */
export function cobroPilotoEnCurso(snapshot: unknown): boolean {
  const estado = leerMarcaPiloto(snapshot)?.estado;
  return estado === "COBRANDO" || estado === "EN_REVISION" || estado === "ACREDITADA" || estado === "PAGADO";
}
