/**
 * QR fijo de Mercado Pago en el mostrador (API Orders, `type: "qr"`, modo estático). Módulo PURO:
 * arma los cuerpos de las llamadas y traduce la order que devuelve Mercado Pago. El plan está en
 * docs/fotoffice/PLAN-MOSTRADOR-QR-Y-VERIFICAR-PAGO.md.
 *
 * Una sucursal y una caja por negocio; el QR impreso es el de la caja y cada cobro crea una order
 * por el monto del ticket, que es lo que el cliente ve al escanear.
 */

/** Cuánto vive una order sin pagar. */
export const VENCE_ORDEN = "PT10M";

/** "1234.50": Mercado Pago pide los importes como texto con dos decimales. */
export function montoMp(minor: number): string {
  return (minor / 100).toFixed(2);
}

/** Los ids externos de la sucursal y la caja: alfanuméricos y únicos por negocio. */
export function idsExternos(workspaceId: string): { sucursal: string; caja: string } {
  const base = workspaceId.replace(/[^A-Za-z0-9]/g, "").slice(0, 36);
  return { sucursal: `FOS${base}`, caja: `FOP${base}` };
}

export type DatosSucursal = {
  nombre: string;
  calle: string;
  numero: string;
  ciudad: string;
  provincia: string;
  latitud: number;
  longitud: number;
  referencia: string | null;
};

export function validarSucursal(d: DatosSucursal): string | null {
  if (!d.nombre.trim()) return "Escribí el nombre del local.";
  if (!d.calle.trim() || !d.numero.trim()) return "Escribí la calle y el número.";
  if (!d.ciudad.trim() || !d.provincia.trim()) return "Escribí la ciudad y la provincia.";
  if (!Number.isFinite(d.latitud) || d.latitud < -56 || d.latitud > -21) return "La latitud no parece de Argentina (va de -21 a -56).";
  if (!Number.isFinite(d.longitud) || d.longitud < -74 || d.longitud > -53) return "La longitud no parece de Argentina (va de -53 a -74).";
  return null;
}

export function cuerpoSucursal(d: DatosSucursal, externalId: string) {
  return {
    name: d.nombre.trim().slice(0, 60),
    external_id: externalId,
    location: {
      street_name: d.calle.trim(),
      street_number: d.numero.trim(),
      city_name: d.ciudad.trim(),
      state_name: d.provincia.trim(),
      latitude: d.latitud,
      longitude: d.longitud,
      ...(d.referencia?.trim() ? { reference: d.referencia.trim() } : {}),
    },
  };
}

export function cuerpoCaja(storeId: string, externalStoreId: string, externalId: string) {
  return {
    name: "Mostrador",
    store_id: storeId,
    external_store_id: externalStoreId,
    external_id: externalId,
    config: { qr: { operating_mode: "pdv" } },
  };
}

export function cuerpoOrden(d: { montoMinor: number; externalPosId: string; referencia: string; descripcion: string }) {
  const monto = montoMp(d.montoMinor);
  return {
    type: "qr",
    total_amount: monto,
    description: d.descripcion.slice(0, 150),
    external_reference: d.referencia,
    expiration_time: VENCE_ORDEN,
    config: { qr: { external_pos_id: d.externalPosId, mode: "static" } },
    transactions: { payments: [{ amount: monto }] },
  };
}

export type EstadoOrden = "ESPERANDO" | "PAGADO" | "CANCELADO" | "VENCIDO" | "DEVUELTO" | "EN_REVISION";

export type OrdenQr = { id: string; estado: EstadoOrden; montoMinor: number; referencia: string | null; medio: string | null };

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/**
 * La order de Mercado Pago → lo que el mostrador necesita. Pagada = order `processed` con su
 * pago `processed`/`accredited` (la documentación no es uniforme con el detalle de la order).
 */
export function leerOrden(raw: unknown): OrdenQr | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = texto(o.id);
  if (!id) return null;
  const total = Number(o.total_amount);
  const pagos = ((o.transactions as Record<string, unknown> | undefined)?.payments ?? []) as Record<string, unknown>[];
  const pago = Array.isArray(pagos) ? pagos[0] : undefined;
  const estadoPago = texto(pago?.status);
  const detallePago = texto(pago?.status_detail);
  const status = texto(o.status);
  const detalle = texto(o.status_detail);
  let estado: EstadoOrden = "ESPERANDO";
  if (status === "processed") {
    if (detalle === "partially_refunded") estado = "PAGADO";
    else if (estadoPago === "processed" || detallePago === "accredited" || detalle === "accredited" || detalle === "processed") estado = "PAGADO";
    else estado = "EN_REVISION";
  } else if (status === "canceled") estado = "CANCELADO";
  else if (status === "expired") estado = "VENCIDO";
  else if (status === "refunded") estado = "DEVUELTO";
  else if (detallePago === "in_review") estado = "EN_REVISION";
  const medio = texto((pago?.payment_method as Record<string, unknown> | undefined)?.type);
  return { id, estado, montoMinor: Number.isFinite(total) ? Math.round(total * 100) : 0, referencia: texto(o.external_reference), medio };
}

const MEDIOS_QR: Record<string, string> = {
  account_money: "QR · dinero en cuenta",
  credit_card: "QR · tarjeta de crédito",
  debit_card: "QR · tarjeta de débito",
  digital_currency: "QR · cuotas sin tarjeta",
};

export function medioDeOrden(medio: string | null): string {
  return (medio && MEDIOS_QR[medio]) ?? "QR de Mercado Pago";
}
