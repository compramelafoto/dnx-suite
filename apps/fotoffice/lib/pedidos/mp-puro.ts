import { pesos } from "@/lib/digitalizacion/entrega";

/**
 * Lo puro del pago de cuotas con Mercado Pago (etapa 3, Entrega B2): la referencia que viaja en
 * la preferencia y vuelve en el aviso, y los hechos de un pago leído. Sin base ni red.
 */

export const PREFIJO_REFERENCIA_CUOTA = "fo-pedcuota:";

/** Título de la tarea para el responsable cuando un pago aprobado no se pudo aplicar. */
export const TITULO_TAREA_PAGO_SIN_APLICAR = "Pago de Mercado Pago sin aplicar: devolver o aplicar a mano";

/** Título de la tarea de la consulta cuando Mercado Pago devolvió un pago ya acreditado (o hubo contracargo). */
export const TITULO_TAREA_PAGO_DEVUELTO = "Mercado Pago devolvió un pago acreditado: anular el cobro si corresponde";

/**
 * La referencia que viaja en la preferencia: `fo-pedcuota:<pedidoId>:<cuotaId>`. Lleva el pedido para
 * poder encontrarlo aunque la cuota se haya borrado al editar el plan (B2-2). Sin pedido arma el formato
 * viejo (`fo-pedcuota:<cuotaId>`), que se sigue aceptando: es el de las preferencias ya abiertas.
 */
export function referenciaCuota(cuotaId: string, pedidoId?: string): string {
  return pedidoId ? `${PREFIJO_REFERENCIA_CUOTA}${pedidoId}:${cuotaId}` : `${PREFIJO_REFERENCIA_CUOTA}${cuotaId}`;
}

export type ReferenciaCuota = { cuotaId: string; pedidoId: string | null };

const idDeReferenciaValido = (id: string) => id.length > 0 && id.length <= 64 && !id.includes(":");

/** Lee los dos formatos de referencia. null si el pago es de otra cosa o la referencia no se entiende. */
export function leerReferenciaCuota(raw: unknown): ReferenciaCuota | null {
  if (typeof raw !== "string" || !raw.startsWith(PREFIJO_REFERENCIA_CUOTA)) return null;
  const resto = raw.slice(PREFIJO_REFERENCIA_CUOTA.length).trim();
  const partes = resto.split(":");
  if (partes.length === 1) return idDeReferenciaValido(partes[0]!) ? { cuotaId: partes[0]!, pedidoId: null } : null;
  if (partes.length === 2 && idDeReferenciaValido(partes[0]!) && idDeReferenciaValido(partes[1]!)) return { pedidoId: partes[0]!, cuotaId: partes[1]! };
  return null;
}

/** El id de cuota que viaja en un pago de Mercado Pago (de los dos formatos), o null si el pago es de otra cosa. */
export function cuotaDeReferencia(raw: unknown): string | null {
  return leerReferenciaCuota(raw)?.cuotaId ?? null;
}

// --- Rastro para el estudio (B2-1, B2-2, B2-4) ----------------------------------------------------

/** Importe en pesos para los textos (`$ 40.000,00`). */
export function pesosDeCentavos(centavos: number): string {
  return `$ ${(centavos / 100).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const POR_QUE_SIN_APLICAR: Record<string, string> = {
  EXCEDE: "supera lo que falta cobrar del pedido",
  CANCELADO: "el pedido está cancelado",
  SIN_CAJA: "Caja está apagada",
  SIN_CUENTA: "no hay una cuenta de Caja donde depositarlo",
  DATOS: "no es en pesos o el importe no se puede imputar",
  NO_EXISTE: "no encontramos el pedido",
};

/** Texto de la tarea del pedido cuando un pago aprobado no se pudo aplicar. Determinístico: sirve para no repetirla. */
export function tituloPagoSinAplicar(providerPaymentId: string, centavos: number, motivo: string, retenidoPlataforma = 0): string {
  const porque = POR_QUE_SIN_APLICAR[motivo] ?? "falló el registro automático";
  return `Mercado Pago: llegó el pago N° ${providerPaymentId} de ${pesosDeCentavos(centavos)} y no se pudo aplicar (${porque}). Aplicalo a mano o devolvelo.${avisoRetenido(retenidoPlataforma)}`;
}

/**
 * F1: si la plataforma ya retuvo su comisión de un pago que quedó sin aplicar, el cobro que se
 * registre a mano la devengaría otra vez: el cobro manual (ni "Verificar pago" del mostrador, que
 * busca en otros pagos) no guarda la referencia del pago, así que no hay forma confiable de
 * vincularlos. Queda dicho en la tarea, con el monto.
 */
function avisoRetenido(retenidoPlataforma: number): string {
  return retenidoPlataforma > 0
    ? ` La plataforma ya retuvo ${pesos(retenidoPlataforma)} de comisión de este pago: si lo registrás a mano, avisá a DNX para que no se cobre dos veces.`
    : "";
}

/** Texto cuando el pago es de una cuota que se borró al editar el plan (B2-2). */
export function tituloPagoCuotaInexistente(providerPaymentId: string, centavos: number, retenidoPlataforma = 0): string {
  return `Mercado Pago: llegó el pago N° ${providerPaymentId} de ${pesosDeCentavos(centavos)} por una cuota que ya no existe: aplicalo a mano o devolvelo.${avisoRetenido(retenidoPlataforma)}`;
}

/**
 * Lo que Mercado Pago dice de un pago que ya se había acreditado y después se dio vuelta: devuelto
 * (`refunded`, o `approved` con `status_detail` `partially_refunded`), contracargo (`charged_back`),
 * en reclamo (`in_mediation`) o cancelado (`cancelled`). null si sigue aprobado o no se entiende.
 */
export type ReversoMp = "refunded" | "partially_refunded" | "charged_back" | "in_mediation" | "cancelled";

export function reversoDelPago(pago: { status: string; rawSanitized: Record<string, unknown> }): ReversoMp | null {
  const crudo = typeof pago.rawSanitized.status === "string" ? pago.rawSanitized.status.toLowerCase() : null;
  const detalle = typeof pago.rawSanitized.status_detail === "string" ? pago.rawSanitized.status_detail.toLowerCase() : null;
  const estado =
    crudo ??
    ({ REFUNDED: "refunded", CHARGEBACK: "charged_back", CANCELLED: "cancelled", APPROVED: "approved" } as Record<string, string>)[pago.status] ??
    null;
  if (estado === "refunded") return "refunded";
  if (estado === "charged_back") return "charged_back";
  if (estado === "in_mediation") return "in_mediation";
  if (estado === "cancelled" || estado === "canceled") return "cancelled";
  if (estado === "approved" && detalle === "partially_refunded") return "partially_refunded";
  return null;
}

const QUE_PASO: Record<ReversoMp, string> = {
  refunded: "devuelto",
  partially_refunded: "devuelto en parte",
  charged_back: "contracargo",
  in_mediation: "en reclamo",
  cancelled: "cancelado",
};

/** Igual, para un segundo pago que nunca entró en Caja (galerías: `PAGO_DUPLICADO`): no hay nada que anular. */
export function tituloPagoDuplicadoDevuelto(providerPaymentId: string, centavos: number, reverso: ReversoMp): string {
  return `Mercado Pago devolvió (o le reclamaron) el pago N° ${providerPaymentId} de ${pesosDeCentavos(centavos)} (${QUE_PASO[reverso]}): era un segundo pago que no se anotó en Caja, así que no hay nada que anular.`;
}

/** El aviso de una devolución o un contracargo (B2-4). Uno por pago y estado: el texto cambia con el estado. */
export function tituloPagoDevuelto(providerPaymentId: string, centavos: number, reverso: ReversoMp, queAnular = "el cobro"): string {
  return `Mercado Pago devolvió (o le reclamaron) el pago N° ${providerPaymentId} de ${pesosDeCentavos(centavos)} (${QUE_PASO[reverso]}): anulá ${queAnular} si corresponde.`;
}

/** Los `fee_details` que paga el negocio: la comisión de Mercado Pago y la de la plataforma (`marketplace_fee`, que MP informa como `application_fee`). */
const COMISIONES_DEL_COBRADOR = new Set(["mercadopago_fee", "application_fee"]);

/**
 * Lo que Mercado Pago le descontó al negocio, en centavos: la suma de los `fee_details` de tipo
 * `mercadopago_fee` y `application_fee` (montos en pesos). Con las dos, el neto del cobro y el
 * EGRESO de Caja dan lo mismo que la app de Mercado Pago. `financing_fee` lo paga el comprador: no
 * cuenta. null si no viene, no se entiende, o es mayor que el pago (no se inventa).
 */
export function comisionDeMp(rawSanitized: Record<string, unknown>, brutoMinor: number): number | null {
  const detalle = rawSanitized.fee_details;
  if (!Array.isArray(detalle)) return null;
  let suma = 0;
  let hay = false;
  for (const fila of detalle) {
    if (typeof fila !== "object" || fila === null) continue;
    const { type, amount } = fila as { type?: unknown; amount?: unknown };
    if (typeof type !== "string" || !COMISIONES_DEL_COBRADOR.has(type)) continue;
    const valido = typeof amount === "number" && Number.isFinite(amount) && amount >= 0;
    // Un `application_fee` ilegible se ignora (como en la retención): no anula la comisión de MP.
    if (!valido) {
      if (type === "application_fee") continue;
      return null;
    }
    suma += Math.round((amount as number) * 100);
    hay = true;
  }
  if (!hay || suma > brutoMinor) return null;
  return suma;
}

function hayComisionDePlataforma(raw: Record<string, unknown>): boolean {
  if (!Array.isArray(raw.fee_details)) return false;
  return raw.fee_details.some((f) => {
    if (typeof f !== "object" || f === null) return false;
    const { type, amount } = f as { type?: unknown; amount?: unknown };
    return type === "application_fee" && typeof amount === "number" && Number.isFinite(amount) && amount > 0;
  });
}

export type HechosDelPago = {
  providerPaymentId: string;
  amountMinor: number;
  currency: string;
  /** `date_approved`; null si no viene o no se entiende. */
  paidAt: Date | null;
  /** Comisión de Mercado Pago (y de la plataforma, si retuvo) en centavos, o null si no viene. */
  feeMinor: number | null;
  /** Si en `feeMinor` hay una parte de la plataforma (`application_fee` > 0): cambia el texto del EGRESO. */
  conPlataforma: boolean;
};

/** Lo que la acreditación necesita de un pago leído: id, monto, moneda, fecha y comisión. */
export function hechosDelPago(pago: {
  providerPaymentId: string;
  amountMinor: number;
  currency: string;
  rawSanitized: Record<string, unknown>;
}): HechosDelPago {
  const crudo = pago.rawSanitized.date_approved;
  const fecha = typeof crudo === "string" ? new Date(crudo) : null;
  return {
    providerPaymentId: pago.providerPaymentId,
    amountMinor: pago.amountMinor,
    currency: pago.currency,
    paidAt: fecha && !Number.isNaN(fecha.getTime()) ? fecha : null,
    feeMinor: comisionDeMp(pago.rawSanitized, pago.amountMinor),
    conPlataforma: hayComisionDePlataforma(pago.rawSanitized),
  };
}

/** El `payment_id` de la vuelta de Mercado Pago: sólo dígitos. Lo demás se descarta antes de usarlo. */
export function paymentIdValido(v: unknown): v is string {
  return typeof v === "string" && /^\d{1,20}$/.test(v);
}

/** El id de una cuota que viene de la dirección (`?cuota=` / `?pagar=`): forma de id, nada más. */
export function idDeCuotaValido(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);
}
