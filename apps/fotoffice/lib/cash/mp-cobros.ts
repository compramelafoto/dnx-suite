/**
 * Cobros recibidos en la cuenta de Mercado Pago del negocio. Módulo PURO: arma la consulta a
 * `/v1/payments/search` y traduce cada resultado a lo que muestra la pantalla.
 *
 * Es la base de "Verificar pago" del mostrador (docs/fotoffice/PLAN-MOSTRADOR-QR-Y-VERIFICAR-PAGO.md):
 * primero hay que ver qué cobros devuelve Mercado Pago —en particular si aparecen las
 * transferencias que llegan al CVU desde un banco— antes de buscar uno por monto.
 */

export type CobroMp = {
  id: string;
  /** Cuándo se acreditó; si todavía no, cuándo se creó. */
  fecha: Date | null;
  montoMinor: number;
  estado: string;
  /** Cómo pagó, en palabras: "Transferencia", "Dinero en cuenta", "Tarjeta de crédito"… */
  medio: string;
  /** Nombre o correo de quien pagó, si Mercado Pago lo informa. */
  pagador: string | null;
  descripcion: string | null;
};

const MEDIOS: Record<string, string> = {
  bank_transfer: "Transferencia",
  account_money: "Dinero en cuenta",
  credit_card: "Tarjeta de crédito",
  debit_card: "Tarjeta de débito",
  prepaid_card: "Tarjeta prepaga",
  ticket: "Efectivo (cupón)",
  atm: "Cajero",
  digital_currency: "Cuotas sin tarjeta",
  digital_wallet: "Billetera",
};

/**
 * La consulta: lo cobrado en el rango, del más nuevo al más viejo. Sin `collector.id`, Mercado
 * Pago también devuelve lo que la cuenta PAGÓ (por ejemplo las cuotas de Mercado Crédito).
 */
export function consultaCobros(desde: Date, hasta: Date, collectorId: string, limite = 50): Record<string, string> {
  return {
    "collector.id": collectorId,
    range: "date_created",
    begin_date: desde.toISOString(),
    end_date: hasta.toISOString(),
    sort: "date_created",
    criteria: "desc",
    limit: String(limite),
  };
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function fecha(v: unknown): Date | null {
  const t = texto(v);
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** El cobrador de un resultado: `collector_id` o `collector.id`, según la versión de la API. */
function cobradorDe(row: Record<string, unknown>): string | null {
  const directo = row.collector_id;
  if (typeof directo === "number" || typeof directo === "string") return String(directo);
  const anidado = (row.collector ?? null) as Record<string, unknown> | null;
  const id = anidado?.id;
  return typeof id === "number" || typeof id === "string" ? String(id) : null;
}

/**
 * Un resultado de `/v1/payments/search` → lo que se muestra. Sin datos de más (ni tarjeta ni
 * documento). Si el cobrador es otra cuenta, es un pago que hizo el negocio, no un cobro: se
 * descarta aunque Mercado Pago lo haya devuelto (el filtro de la consulta no siempre alcanza).
 */
export function aCobroMp(row: Record<string, unknown>, collectorId: string): CobroMp | null {
  const cobrador = cobradorDe(row);
  if (cobrador !== null && cobrador !== collectorId) return null;
  const id = row.id;
  const monto = Number(row.transaction_amount);
  if ((typeof id !== "number" && typeof id !== "string") || !Number.isFinite(monto)) return null;

  const payer = (row.payer ?? {}) as Record<string, unknown>;
  const nombre = [texto(payer.first_name), texto(payer.last_name)].filter(Boolean).join(" ");
  const tipo = texto(row.payment_type_id);
  const operacion = texto(row.operation_type);

  return {
    id: String(id),
    fecha: fecha(row.date_approved) ?? fecha(row.date_created),
    montoMinor: Math.round(monto * 100),
    estado: texto(row.status) ?? "desconocido",
    medio: (tipo && MEDIOS[tipo]) ?? (operacion === "money_transfer" ? "Transferencia" : (tipo ?? "Otro")),
    pagador: nombre !== "" ? nombre : texto(payer.email),
    descripcion: texto(row.description),
  };
}

export const ESTADOS_COBRO: Record<string, string> = {
  approved: "Acreditado",
  pending: "Pendiente",
  in_process: "En revisión",
  rejected: "Rechazado",
  refunded: "Devuelto",
  cancelled: "Cancelado",
  charged_back: "Contracargo",
};
