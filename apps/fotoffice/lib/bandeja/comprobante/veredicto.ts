/**
 * PURO. Verificar un comprobante de transferencia que mandó un cliente por WhatsApp: con lo que se
 * leyó de la imagen y lo que dice el Mercado Pago del estudio, decide si el pago entró.
 *   - Primero se busca la operación por su número (el que figura en el comprobante).
 *   - Si no aparece (una transferencia desde un banco tiene otro número), vale un pago aprobado del
 *     mismo monto hasta 6 horas antes o después de la fecha del comprobante: "probable", no "confirmado".
 */

export type Leido = {
  esComprobante: boolean;
  operacion: string | null;
  monto: number | null;
  /** ISO, o null si no se leyó. */
  fecha: string | null;
  origen: string | null;
  destinatario: string | null;
};

export type PagoMp = { id: string; monto: number; estado: string; fecha: string | null; pagador: string | null };

export type Veredicto =
  | { estado: "CONFIRMADO" | "PENDIENTE" | "MONTO_DISTINTO" | "PROBABLE"; pago: PagoMp }
  | { estado: "NO_ENCONTRADO" | "NO_ES_COMPROBANTE" | "SIN_DATOS" };

const VENTANA_MS = 6 * 3_600_000;
const mismoMonto = (a: number, b: number) => Math.abs(a - b) < 0.5;

export function decidir(leido: Leido, porOperacion: PagoMp | null, candidatos: readonly PagoMp[]): Veredicto {
  if (!leido.esComprobante) return { estado: "NO_ES_COMPROBANTE" };
  if (leido.monto === null || !(leido.monto > 0)) return { estado: "SIN_DATOS" };
  if (porOperacion) {
    if (!mismoMonto(porOperacion.monto, leido.monto)) return { estado: "MONTO_DISTINTO", pago: porOperacion };
    return { estado: porOperacion.estado === "approved" ? "CONFIRMADO" : "PENDIENTE", pago: porOperacion };
  }
  const cuando = leido.fecha ? Date.parse(leido.fecha) : NaN;
  const cerca = candidatos.find((p) => {
    if (p.estado !== "approved" || !mismoMonto(p.monto, leido.monto!)) return false;
    if (Number.isNaN(cuando) || !p.fecha) return true;
    return Math.abs(Date.parse(p.fecha) - cuando) <= VENTANA_MS;
  });
  return cerca ? { estado: "PROBABLE", pago: cerca } : { estado: "NO_ENCONTRADO" };
}

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const hora = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const cuandoFue = (iso: string | null) => (iso && !Number.isNaN(Date.parse(iso)) ? ` el ${hora.format(new Date(iso))}` : "");

/** El texto que queda en el chat (mensaje del sistema) y que se muestra al tocar el botón. */
export function textoDelVeredicto(v: Veredicto, leido: Leido): string {
  const monto = leido.monto !== null ? pesos.format(leido.monto) : "sin monto";
  const op = leido.operacion ? ` (operación ${leido.operacion})` : "";
  switch (v.estado) {
    case "CONFIRMADO":
      return `Pago confirmado en Mercado Pago: ${pesos.format(v.pago.monto)} acreditado${cuandoFue(v.pago.fecha)}${op}.`;
    case "PENDIENTE":
      return `El pago de ${pesos.format(v.pago.monto)}${op} figura en Mercado Pago pero todavía no está acreditado (estado: ${v.pago.estado}).`;
    case "MONTO_DISTINTO":
      return `La operación${op} existe, pero en Mercado Pago es de ${pesos.format(v.pago.monto)} y el comprobante dice ${monto}. Revisalo.`;
    case "PROBABLE":
      return `No encontré la operación${op}, pero entró un pago de ${pesos.format(v.pago.monto)}${cuandoFue(v.pago.fecha)}${v.pago.pagador ? ` de ${v.pago.pagador}` : ""}. Probablemente es este: confirmalo antes de entregar.`;
    case "NO_ENCONTRADO":
      return `No encontré en Mercado Pago un pago de ${monto}${op}. Puede tardar unos minutos en aparecer o haber ido a otra cuenta: revisalo en la app.`;
    case "NO_ES_COMPROBANTE":
      return "La imagen no parece un comprobante de pago.";
    case "SIN_DATOS":
      return "No pude leer el monto del comprobante. Revisalo a mano.";
  }
}
