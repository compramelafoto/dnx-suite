/**
 * El Mostrador cuando el ticket tiene trabajos "con proceso" (copias a laboratorio, fotolibros,
 * rollos, digitalizaciones) o renglones marcados «Seña» (cualquier otro producto que el cliente
 * deja señado para retirar): esa parte se vuelve un pedido con seña y fecha de entrega, y lo que
 * se lleva en el momento sigue siendo una venta común. Módulo PURO.
 *
 * Importes en centavos (`minor`), como el resto del Mostrador.
 */

/** "aaaa-mm-dd" + días, salteando el domingo (si cae domingo, pasa al lunes). */
export function sugerirEntrega(hoy: string, dias: number): string {
  const d = new Date(`${hoy}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.max(0, Math.floor(dias)));
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Días corridos de `desde` a `hasta` ("aaaa-mm-dd"); nunca negativo. */
export function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(`${desde}T12:00:00Z`);
  const b = Date.parse(`${hasta}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** La seña que se propone: la mitad, redondeada hacia arriba a $ 100 (lo que se ve en las planillas). */
export function senaSugerida(totalMinor: number): number {
  if (totalMinor <= 0) return 0;
  const mitad = Math.ceil(totalMinor / 2);
  return Math.min(totalMinor, Math.ceil(mitad / 10_000) * 10_000);
}

/** El descuento del ticket repartido en proporción entre el pedido y lo que se lleva en el momento. */
export function repartirDescuento(subtotalPedido: number, subtotalVenta: number, descuento: number): { pedido: number; venta: number } {
  const total = subtotalPedido + subtotalVenta;
  if (descuento <= 0 || total <= 0) return { pedido: 0, venta: 0 };
  const pedido = Math.round((descuento * subtotalPedido) / total);
  return { pedido, venta: descuento - pedido };
}

/** Cuánto se cobra ahora: lo que se lleva entero, más la seña (o el total) del pedido. */
export function aCobrarAhora(totalVenta: number, totalPedido: number, sena: number | null): number {
  const delPedido = sena === null ? totalPedido : Math.min(Math.max(0, sena), totalPedido);
  return totalVenta + delPedido;
}

/** Días que se sugieren para un producto sin regla propia que queda señado para retirar. */
export const PLAZO_SIN_REGLA_DIAS = 1;

/**
 * Qué renglones del ticket quedan como pedido y cuáles se llevan en el momento. Va al pedido lo
 * que tiene proceso (su producto tiene regla en "Proyecto que genera"), siempre, y lo que el
 * cajero marcó «Seña» (`paraRetirar`), tenga producto o sea a mano. El resto es venta común.
 * Cada parte respeta el orden del ticket. La usan el Mostrador (para mostrar el recuadro) y el
 * servidor (para cobrar), así las dos cuentas no se separan.
 */
export function separarTicket<L extends { productId: string | null; paraRetirar?: boolean }>(
  lineas: readonly L[],
  conProceso: ReadonlySet<string>,
): { delPedido: L[]; enElMomento: L[] } {
  const delPedido: L[] = [];
  const enElMomento: L[] = [];
  for (const l of lineas) {
    const tieneProceso = l.productId !== null && conProceso.has(l.productId);
    (tieneProceso || l.paraRetirar === true ? delPedido : enElMomento).push(l);
  }
  return { delPedido, enElMomento };
}
