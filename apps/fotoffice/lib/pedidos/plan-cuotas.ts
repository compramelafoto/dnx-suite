/**
 * Plan de cuotas de un pedido (etapa 3, Entrega A). Módulo PURO: sin base, sin reloj y sin husos.
 *
 * Las fechas son días de calendario de Argentina en texto "aaaa-mm-dd" (quien llama pasa `desde` =
 * hoy en Buenos Aires). Las cuentas se hacen en UTC puro sobre esos días, así que no hay corrimientos.
 * El dinero se cuenta en centavos enteros y se devuelve en pesos con dos decimales.
 *
 * Reglas (Global Constraints):
 * - mensual desde el día de confirmación: la cuota i vence el mismo día del mes i−1, acotado al
 *   último día del mes;
 * - si la última vencería después del evento, las N cuotas se reparten parejas entre la confirmación
 *   y el día del evento, redondeando a días;
 * - evento ya pasado (antes de `desde`): una sola cuota que vence `desde`, con aviso;
 * - importes en partes iguales a centavos; la última absorbe la diferencia;
 * - total cero: no hay plan.
 */

// --- Dinero -----------------------------------------------------------------------------------

/** Pesos (con hasta dos decimales) a centavos enteros. */
export function aCentavos(pesos: number): number {
  return Math.round(pesos * 100);
}

/** Centavos enteros a pesos con dos decimales. */
export function desdeCentavos(centavos: number): number {
  return Math.round(centavos) / 100;
}

/** true si el número es finito y no tiene más de dos decimales (tolerando el error del flotante). */
export function tieneHastaDosDecimales(n: number): boolean {
  return Number.isFinite(n) && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
}

// --- Fechas (días de calendario) --------------------------------------------------------------

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const DIA_MS = 24 * 60 * 60 * 1000;

function partes(fecha: string): [number, number, number] | null {
  const m = FECHA.exec(fecha);
  if (!m) return null;
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(a, me - 1, d));
  if (t.getUTCFullYear() !== a || t.getUTCMonth() !== me - 1 || t.getUTCDate() !== d) return null;
  return [a, me, d];
}

/** "aaaa-mm-dd" que existe en el calendario. */
export function esFechaValida(v: unknown): v is string {
  return typeof v === "string" && partes(v) !== null;
}

function aTexto(t: Date): string {
  return t.toISOString().slice(0, 10);
}

function exigir(fecha: string): [number, number, number] {
  const p = partes(fecha);
  if (!p) throw new RangeError(`Fecha inválida: ${fecha}`);
  return p;
}

/** Suma meses conservando el día, acotado al último día del mes (31/01 + 1 = 28/02 o 29/02). */
export function sumarMeses(fecha: string, meses: number): string {
  const [a, m, d] = exigir(fecha);
  const ultimo = new Date(Date.UTC(a, m - 1 + meses + 1, 0)).getUTCDate();
  return aTexto(new Date(Date.UTC(a, m - 1 + meses, Math.min(d, ultimo))));
}

export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = exigir(fecha);
  return aTexto(new Date(Date.UTC(a, m - 1, d + dias)));
}

/** Días de `desde` a `hasta` (negativo si `hasta` es anterior). */
export function diasEntre(desde: string, hasta: string): number {
  const [a1, m1, d1] = exigir(desde);
  const [a2, m2, d2] = exigir(hasta);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / DIA_MS);
}

/**
 * Meses completos de `desde` a `hasta`: la mayor cantidad m tal que `desde` + m meses no pasa de
 * `hasta`. Ej.: 2026-10-08 → 2026-12-07 = 1; → 2026-12-08 = 2. Si `hasta` es anterior, 0.
 */
export function mesesCompletos(desde: string, hasta: string): number {
  const [a1, m1] = exigir(desde);
  const [a2, m2] = exigir(hasta);
  let meses = Math.max(0, (a2 - a1) * 12 + (m2 - m1));
  while (meses > 0 && sumarMeses(desde, meses) > hasta) meses--;
  return meses;
}

// --- Plan -------------------------------------------------------------------------------------

export type CuotaPlan = { position: number; dueDate: string; amountArs: number };

/** Reparte el total en `n` partes iguales a centavos; la última absorbe la diferencia. */
export function repartirImporte(total: number, n: number): number[] {
  const centavos = aCentavos(total);
  const parte = Math.floor(centavos / n);
  return Array.from({ length: n }, (_, i) => desdeCentavos(i === n - 1 ? centavos - parte * (n - 1) : parte));
}

/**
 * Vencimientos de `n` cuotas desde `desde`. Mensuales; si la última pasa del evento, parejas entre
 * `desde` y el evento. Evento anterior a `desde`: lo resuelve `generarPlan` (una sola cuota).
 */
function vencimientos(n: number, desde: string, fechaEvento: string | null): string[] {
  const mensuales = Array.from({ length: n }, (_, i) => sumarMeses(desde, i));
  if (!fechaEvento || mensuales[n - 1]! <= fechaEvento) return mensuales;
  if (n === 1) return [desde];
  const dias = diasEntre(desde, fechaEvento);
  return Array.from({ length: n }, (_, i) => sumarDias(desde, Math.round((i * dias) / (n - 1))));
}

/**
 * Genera el plan. `total` en pesos (hasta dos decimales); `cuotas` ≥ 1; `desde` y `fechaEvento` en
 * "aaaa-mm-dd". Total cero (o negativo): `[]`. Evento anterior a `desde`: una sola cuota en `desde`.
 */
export function generarPlan(input: {
  total: number;
  cuotas: number;
  desde: string;
  fechaEvento?: string | null;
}): CuotaPlan[] {
  exigir(input.desde);
  const evento = input.fechaEvento ?? null;
  if (evento !== null) exigir(evento);
  if (!Number.isFinite(input.total) || aCentavos(input.total) <= 0) return [];
  let n = Math.max(1, Math.floor(Number.isFinite(input.cuotas) ? input.cuotas : 1));
  if (evento !== null && evento < input.desde) n = 1;
  // Nunca más cuotas que centavos: cada cuota tiene que ser mayor que cero.
  n = Math.min(n, aCentavos(input.total));
  const fechas = vencimientos(n, input.desde, evento);
  const importes = repartirImporte(input.total, n);
  return fechas.map((dueDate, i) => ({ position: i + 1, dueDate, amountArs: importes[i]! }));
}

export type AvisoPlan = "EVENTO_PASADO" | "TOPE_EVENTO";

export const ETIQUETA_AVISO_PLAN: Record<AvisoPlan, string> = {
  EVENTO_PASADO: "El evento ya pasó: queda una sola cuota que vence hoy.",
  TOPE_EVENTO: "Las cuotas mensuales no entraban antes del evento: se repartieron hasta la fecha del evento.",
};

/**
 * Plan desde la opción de pago elegida (`cuotas` y `total` de `OpcionPago`, ver `opciones-pago.ts`).
 * Contado es una opción de 1 cuota: vence el día de la confirmación (`desde`).
 */
export function planDesdeOpcion(
  opcion: { cuotas: number; total: number },
  contexto: { desde: string; fechaEvento?: string | null },
): { cuotas: CuotaPlan[]; aviso: AvisoPlan | null } {
  const fechaEvento = contexto.fechaEvento ?? null;
  const cuotas = generarPlan({ total: opcion.total, cuotas: opcion.cuotas, desde: contexto.desde, fechaEvento });
  let aviso: AvisoPlan | null = null;
  if (cuotas.length > 0 && fechaEvento !== null) {
    if (fechaEvento < contexto.desde) aviso = "EVENTO_PASADO";
    else if (opcion.cuotas > 1 && sumarMeses(contexto.desde, cuotas.length - 1) > fechaEvento) aviso = "TOPE_EVENTO";
  }
  return { cuotas, aviso };
}

export type ResultadoValidacion = { ok: true } | { ok: false; error: string };

/**
 * Valida un plan editado a mano: fechas reales, importes mayores que cero con hasta dos decimales y
 * la suma exacta del total (a centavos). Con total cero, el plan tiene que estar vacío.
 */
export function validarPlan(
  cuotas: ReadonlyArray<{ dueDate: string; amountArs: number }>,
  total: number,
): ResultadoValidacion {
  if (!Number.isFinite(total) || total < 0 || !tieneHastaDosDecimales(total)) {
    return { ok: false, error: "El total del pedido no es válido." };
  }
  const totalCentavos = aCentavos(total);
  if (totalCentavos === 0) {
    return cuotas.length === 0 ? { ok: true } : { ok: false, error: "Un pedido sin importe no lleva cuotas." };
  }
  if (cuotas.length === 0) return { ok: false, error: "El plan tiene que tener al menos una cuota." };
  let suma = 0;
  for (const [i, c] of cuotas.entries()) {
    if (!esFechaValida(c.dueDate)) return { ok: false, error: `La cuota ${i + 1} no tiene una fecha válida.` };
    if (typeof c.amountArs !== "number" || !tieneHastaDosDecimales(c.amountArs) || aCentavos(c.amountArs) <= 0) {
      return { ok: false, error: `El importe de la cuota ${i + 1} tiene que ser mayor que cero.` };
    }
    suma += aCentavos(c.amountArs);
  }
  if (suma !== totalCentavos) {
    const diferencia = desdeCentavos(totalCentavos - suma);
    return {
      ok: false,
      error:
        diferencia > 0
          ? `Las cuotas suman menos que el total del pedido (faltan $ ${formatoPesos(diferencia)}).`
          : `Las cuotas suman más que el total del pedido (sobran $ ${formatoPesos(-diferencia)}).`,
    };
  }
  return { ok: true };
}

function formatoPesos(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
