/**
 * Precio de un cassette que no se pudo digitalizar (cinta cortada, vacía, mojada…). Módulo PURO:
 * sin base y sin reloj. Lo usa `servidor/bonificacion.ts`.
 *
 * El negocio configura cuánto se cobra por un cassette que no funcionó (Digitalización →
 * «Configuración»; DNX: 2.000 pesos). Al registrarlo, el pedido baja sólo: se le descuenta al
 * renglón de los cassettes la diferencia entre lo que vale un cassette y ese precio.
 *
 * - **Cómo se guarda el descuento:** en el `descuento` del mismo renglón de los cassettes, como
 *   MONTO (un renglón con precio negativo no pasa `validarItems`, que descartaría la lista entera).
 *   Si el renglón ya tenía un descuento, se pasa a MONTO con el mismo importe y se le suma. Así la
 *   cantidad de cassettes vendidos (lo que cuenta `cassettes.ts`) no cambia.
 * - **Lo que vale un cassette** sale del renglón SIN las bonificaciones ya hechas
 *   (`(neto + bonificaciones previas) / cantidad`): el segundo cassette que falla se descuenta igual
 *   que el primero.
 * - **Las cuotas:** el total baja y el plan tiene que seguir sumando el total. La diferencia se
 *   saca de las cuotas libres (sin ningún cobro imputado, sin transferencia anunciada y que no son
 *   de un cargo extra), de la última hacia atrás. Si no alcanza (el cliente ya pagó), no se toca el
 *   dinero: el equipo lo resuelve a mano y queda una tarea en el pedido.
 */

type Objeto = Record<string, unknown>;
const esObjeto = (v: unknown): v is Objeto => typeof v === "object" && v !== null && !Array.isArray(v);
const numero = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const aCentavos = (pesos: number): number => Math.round(pesos * 100);
const aPesos = (centavos: number): number => centavos / 100;

/** Tope del precio configurable (el mismo de los importes de un pedido). */
export const MAX_PRECIO_NO_DIGITALIZABLE = 99_999_999;

/**
 * Valida el precio que se escribe en la configuración. Vacío = «se cobra completo» (null). Pesos
 * con hasta dos decimales, de 0 en adelante (0 = no se cobra nada por un cassette que no funcionó).
 */
export function validarPrecioNoDigitalizable(v: unknown): { ok: true; precio: number | null } | { ok: false; error: string } {
  if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) return { ok: true, precio: null };
  const n = typeof v === "string" ? Number(v.trim().replace(",", ".")) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > MAX_PRECIO_NO_DIGITALIZABLE || Math.abs(aCentavos(n) - n * 100) > 1e-6) {
    return { ok: false, error: "Escribí el precio en pesos (por ejemplo 2000), o dejalo vacío para cobrarlo completo." };
  }
  return { ok: true, precio: aPesos(aCentavos(n)) };
}

export type CalculoBonificacion =
  | { ok: true; itemId: string; precioCassetteArs: number; bonificacionArs: number }
  /** SIN_PRECIO: el negocio no configuró precio. SIN_RENGLON: no se sabe qué renglón es el de los cassettes. NADA: el cassette ya vale eso o menos. */
  | { ok: false; motivo: "SIN_PRECIO" | "SIN_RENGLON" | "NADA" };

/**
 * Cuánto se le descuenta al pedido por un cassette que no se pudo digitalizar. `bonificacionesPreviasArs`
 * es lo ya descontado por otros cassettes del mismo trabajo (se suma de vuelta para saber lo que
 * vale un cassette). Nunca deja el renglón por debajo de cero.
 */
export function calcularBonificacion(a: {
  items: unknown;
  totals: unknown;
  pedidoItemIndex: number | null;
  bonificacionesPreviasArs: number;
  precioNoDigitalizableArs: number | null;
}): CalculoBonificacion {
  if (a.precioNoDigitalizableArs === null) return { ok: false, motivo: "SIN_PRECIO" };
  if (!Array.isArray(a.items) || a.pedidoItemIndex === null || !Number.isInteger(a.pedidoItemIndex)) return { ok: false, motivo: "SIN_RENGLON" };
  const it = a.items[a.pedidoItemIndex];
  if (!esObjeto(it) || typeof it.id !== "string") return { ok: false, motivo: "SIN_RENGLON" };
  const cantidad = numero(it.cantidad);
  if (cantidad === null || cantidad <= 0) return { ok: false, motivo: "SIN_RENGLON" };
  const renglon = esObjeto(a.totals) && esObjeto(a.totals.renglones) ? a.totals.renglones[it.id] : undefined;
  const neto = esObjeto(renglon) ? numero(renglon.neto) : null;
  if (neto === null) return { ok: false, motivo: "SIN_RENGLON" };
  const netoMinor = aCentavos(neto);
  const original = netoMinor + aCentavos(Math.max(0, a.bonificacionesPreviasArs));
  const precioCassette = Math.round(original / cantidad);
  const bonif = Math.min(precioCassette - aCentavos(a.precioNoDigitalizableArs), netoMinor);
  if (bonif <= 0) return { ok: false, motivo: "NADA" };
  return { ok: true, itemId: it.id, precioCassetteArs: aPesos(precioCassette), bonificacionArs: aPesos(bonif) };
}

/** El descuento del renglón en centavos según los `totals` guardados (0 si no hay). */
export function descuentoDelRenglonMinor(totals: unknown, itemId: string): number | null {
  if (!esObjeto(totals) || !esObjeto(totals.renglones)) return null;
  const r = totals.renglones[itemId];
  if (!esObjeto(r)) return null;
  const d = numero(r.descuento);
  return d === null ? null : aCentavos(d);
}

/**
 * Los ítems con el descuento del renglón `itemId` movido en `deltaArs` (positivo: bonificar;
 * negativo: deshacer). El descuento queda como MONTO con lo que ya descontaba el renglón
 * (`descuentoActualMinor`, de los `totals`) más el cambio; si queda en cero, sin descuento.
 * null si el renglón no está.
 */
export function itemsConBonificacion(items: unknown, itemId: string, descuentoActualMinor: number, deltaArs: number): unknown[] | null {
  if (!Array.isArray(items)) return null;
  const i = items.findIndex((x) => esObjeto(x) && x.id === itemId);
  if (i < 0) return null;
  const nuevo = descuentoActualMinor + aCentavos(deltaArs);
  if (nuevo < 0) return null;
  return items.map((x, j) => (j === i ? { ...(x as Objeto), descuento: nuevo === 0 ? null : { tipo: "MONTO", valor: aPesos(nuevo) } } : x));
}

/**
 * Los `totals` guardados con `deltaArs` más de descuento en el renglón `itemId`: su descuento y su
 * neto, el descuento de los ítems, el total y el subtotal de su sección. Como los cargos, se toca
 * sumando y no se recalcula. Sólo toca lo que ya es número.
 */
export function totalesConBonificacion(totals: unknown, itemId: string, seccion: string | null, deltaArs: number): Objeto {
  const t: Objeto = esObjeto(totals) ? structuredClone(totals) : {};
  const delta = aCentavos(deltaArs);
  const mover = (v: unknown, signo: 1 | -1) => (numero(v) !== null ? aPesos(aCentavos(v as number) + signo * delta) : v);
  if (esObjeto(t.renglones) && esObjeto(t.renglones[itemId])) {
    const r = t.renglones[itemId] as Objeto;
    t.renglones[itemId] = { ...r, descuento: mover(r.descuento, 1), neto: mover(r.neto, -1) };
  }
  if (numero(t.descuentoItems) !== null) t.descuentoItems = mover(t.descuentoItems, 1);
  if (numero(t.total) !== null) t.total = mover(t.total, -1);
  if (Array.isArray(t.secciones)) {
    t.secciones = (t.secciones as unknown[]).map((s) => (esObjeto(s) && (s.seccion ?? null) === seccion ? { ...s, subtotal: mover(s.subtotal, -1) } : s));
  }
  return t;
}

export type CuotaParaRepartir = { id: string; position: number; montoMinor: number; libre: boolean };
export type CambioDeCuota = { id: string; montoMinor: number };

/**
 * De dónde sale la bonificación: de las cuotas libres, de la última hacia atrás. `montoMinor` 0 =
 * la cuota se borra. null si las cuotas libres no alcanzan (no se toca nada).
 */
export function repartirBonificacion(cuotas: readonly CuotaParaRepartir[], bonificacionMinor: number): CambioDeCuota[] | null {
  let falta = bonificacionMinor;
  const cambios: CambioDeCuota[] = [];
  for (const c of [...cuotas].sort((a, b) => b.position - a.position)) {
    if (falta <= 0) break;
    if (!c.libre || c.montoMinor <= 0) continue;
    const saco = Math.min(c.montoMinor, falta);
    cambios.push({ id: c.id, montoMinor: c.montoMinor - saco });
    falta -= saco;
  }
  return falta > 0 ? null : cambios;
}

/** «2.000 pesos», «1.500,50 pesos». Nunca con «$». */
export function pesosTexto(ars: number): string {
  const conCentavos = aCentavos(ars) % 100 !== 0;
  return `${new Intl.NumberFormat("es-AR", { minimumFractionDigits: conCentavos ? 2 : 0, maximumFractionDigits: 2 }).format(ars)} pesos`;
}

/** Lo que ve el equipo junto al cassette: «Se cobra 2.000 pesos (descuento de 10.000 pesos)». */
export function textoBonificacion(bonificacionArs: number, precioNoDigitalizableArs: number | null): string {
  const precio = precioNoDigitalizableArs === null ? "" : `Se cobra ${pesosTexto(precioNoDigitalizableArs)} · `;
  return `${precio}descuento de ${pesosTexto(bonificacionArs)} en el pedido`;
}

/** El título de la tarea cuando no se pudo descontar solo (el cliente ya había pagado). */
export function tareaBonificacionAMano(cassette: string, bonificacionArs: number): string {
  return `${cassette} no se pudo digitalizar: correspondía descontar ${pesosTexto(bonificacionArs)}, pero el pedido ya tiene esos pagos hechos. Devolvé la diferencia o ajustá el plan a mano.`;
}

/** El título de la tarea cuando al quitar el cassette no se pudo devolver el descuento solo. */
export function tareaDeshacerAMano(cassette: string, bonificacionArs: number): string {
  return `Se quitó «${cassette} no se pudo digitalizar», pero el renglón del pedido se editó a mano: volvé a sumar ${pesosTexto(bonificacionArs)} al pedido si corresponde.`;
}
