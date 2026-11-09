import { isRenewalPeriod } from "@/lib/membership/enrollment";

/**
 * BOX mensual — la regla, sin base y sin red.
 *
 * Las personas socias de una categoría con caja (`MemberCategory.includesMonthlyBox`) reciben
 * una caja de materiales por cada mes pagado, **en orden y desde la BOX N°1**, sin importar
 * cuándo se sumaron. Reglas decididas por el dueño:
 *
 * 1. Cada mes pagado habilita la caja siguiente. Si un mes no paga, ese mes no hay caja; después
 *    sigue donde quedó: no se saltea ninguna.
 * 2. Después de la última caja cargada queda «al día» hasta que se carguen nuevas (N°11, N°12…).
 *    No vuelve a la N°1.
 * 3. Sólo envío a domicilio.
 *
 * No se guarda un contador de cajas habilitadas: se cuenta cada vez a partir de los cargos y los
 * pagos, que son la fuente de verdad. Así una cuota que se carga a mano, una que entra por
 * Mercado Pago o un pago que después se revierte quedan reflejados sin enganchar nada en el
 * circuito de cobro.
 */

/** Módulo puro: la clave con la que el menú sabe que el workspace usa la BOX mensual. */
export const BOX_MENSUAL_FEATURE = "box-mensual";

export type ConceptoCargo = "INGRESO" | "MENSUAL" | "EXTRAORDINARIA" | "OTRO";

/** Un cargo del socio, con lo que hace falta para saber si es un mes pagado. */
export type CargoParaBox = {
  concept: ConceptoCargo;
  /** `YYYY-MM` para las cuotas; `RENOV-…` para las renovaciones; otras etiquetas para el resto. */
  period: string;
  amountMinor: number;
  balanceMinor: number;
  /**
   * Cuándo se acreditó el último pago que se le imputó (el que lo terminó de cancelar). `null`
   * si ningún pago imputado está acreditado.
   */
  acreditadoEn: Date | null;
};

const PERIODO_MENSUAL = /^\d{4}-(0[1-9]|1[0-2])$/;

/** El mes calendario de Argentina (`YYYY-MM`) de un instante. */
export function periodoArgentino(now: Date): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${v("year")}-${v("month")}`;
}

/** El primer instante de un mes de Argentina (`2026-11` → 1/11/2026 00:00 ART = 03:00 UTC). */
function inicioDelMes(periodo: string): Date {
  const [anio, mes] = periodo.split("-").map(Number);
  return new Date(Date.UTC(anio ?? 1970, (mes ?? 1) - 1, 1, 3));
}

/**
 * Si un cargo es un «mes pagado», que habilita una caja.
 *
 * Cuenta:
 * - **la cuota de un mes** (`MENSUAL`, o `INGRESO`, que son las cuotas mensuales que se pagan
 *   al asociarse), cancelada del todo con al menos un pago acreditado, y **sólo cuando ese mes
 *   ya empezó**: quien adelanta tres cuotas recibe una caja por mes, no tres juntas;
 * - **una renovación** (categorías que se renuevan cuando quieren, `selfRenew`), cancelada con
 *   un pago acreditado. Cada renovación es un mes.
 *
 * No cuenta: una cuota extraordinaria, el carnet impreso, la deuda de apertura, ni un mes que se
 * canceló sin plata (bonificado entero): el beneficio es por mes pagado.
 */
export function esMesPagado(cargo: CargoParaBox, periodoActual: string): boolean {
  if (cargo.acreditadoEn === null) return false;
  if (cargo.amountMinor <= 0 || cargo.balanceMinor > 0) return false;
  if (cargo.concept === "MENSUAL" || cargo.concept === "INGRESO") {
    return PERIODO_MENSUAL.test(cargo.period) && cargo.period <= periodoActual;
  }
  if (cargo.concept === "OTRO") return isRenewalPeriod(cargo.period);
  return false;
}

/**
 * Los meses pagados, del más viejo al más nuevo, con el momento en que cada uno habilitó su
 * caja: cuando se acreditó o, si se pagó por adelantado, cuando empezó ese mes.
 *
 * Un mismo mes cuenta una sola vez aunque tenga dos cargos (una cuota de ingreso y una mensual
 * del mismo período no deberían convivir, pero si pasara no da dos cajas).
 */
export function mesesPagados(cargos: readonly CargoParaBox[], now: Date): Date[] {
  const periodoActual = periodoArgentino(now);
  const porClave = new Map<string, Date>();
  for (const c of cargos) {
    if (!esMesPagado(c, periodoActual)) continue;
    const acreditado = c.acreditadoEn as Date;
    const esMensual = c.concept !== "OTRO";
    const clave = esMensual ? `M:${c.period}` : `R:${c.period}`;
    const desde = esMensual
      ? new Date(Math.max(acreditado.getTime(), inicioDelMes(c.period).getTime()))
      : acreditado;
    const previo = porClave.get(clave);
    if (!previo || desde < previo) porClave.set(clave, desde);
  }
  return [...porClave.values()].sort((a, b) => a.getTime() - b.getTime());
}

export type CajaDelRecorrido = { id: string; number: number; name: string; isActive: boolean };

export type EstadoBox =
  /** Tiene meses pagados sin caja y hay una caja siguiente cargada. */
  | "PARA_ENVIAR"
  /** Recibió una caja por cada mes pagado: espera el próximo pago. */
  | "ESPERANDO_PAGO"
  /** Recibió todas las cajas cargadas: espera que se carguen nuevas. */
  | "AL_DIA";

export type RecorridoBox = {
  estado: EstadoBox;
  /** Meses pagados que habilitan caja. */
  habilitadas: number;
  /** Cajas ya enviadas (en cualquier estado). */
  enviadas: number;
  /** Meses pagados que todavía no tienen su caja. */
  pendientes: number;
  /** La caja que le toca: la de menor N°, activa, que todavía no recibió. */
  proxima: CajaDelRecorrido | null;
  /** Las cajas que hacen falta AHORA para ponerla al día (como mucho, `pendientes`). */
  porEnviar: CajaDelRecorrido[];
  /** Desde cuándo espera la próxima caja: el mes pagado más viejo sin caja. */
  esperaDesde: Date | null;
};

/**
 * Dónde está una persona socia en el recorrido.
 *
 * `cajasEnviadas` son los id de las cajas que ya recibió. Una caja desactivada no se ofrece, pero
 * si ya se envió sigue contando como enviada.
 */
export function recorridoBox(input: {
  meses: readonly Date[];
  cajasEnviadas: readonly string[];
  cajas: readonly CajaDelRecorrido[];
}): RecorridoBox {
  const recibidas = new Set(input.cajasEnviadas);
  const habilitadas = input.meses.length;
  const enviadas = recibidas.size;
  const pendientes = Math.max(0, habilitadas - enviadas);
  const siguientes = input.cajas
    .filter((c) => c.isActive && !recibidas.has(c.id))
    .sort((a, b) => a.number - b.number);
  const proxima = siguientes[0] ?? null;
  const porEnviar = siguientes.slice(0, pendientes);
  const estado: EstadoBox = proxima === null ? "AL_DIA" : pendientes > 0 ? "PARA_ENVIAR" : "ESPERANDO_PAGO";
  return {
    estado,
    habilitadas,
    enviadas,
    pendientes,
    proxima,
    porEnviar,
    esperaDesde: pendientes > 0 ? (input.meses[enviadas] ?? null) : null,
  };
}

/** «BOX N°1 — Mi primer universo creativo: Soltar la mano». Siempre así, en todas las pantallas. */
export function etiquetaBox(caja: { number: number; name: string }): string {
  return `BOX N°${caja.number} — ${caja.name}`;
}

// ---------------------------------------------------------------------------------------------
// Materiales
// ---------------------------------------------------------------------------------------------

export type MaterialBox = { material: string; perBox: number };

/** Lee la columna `materials` sin confiar en ella: lo que no tiene forma de material se descarta. */
export function leerMateriales(valor: unknown): MaterialBox[] {
  if (!Array.isArray(valor)) return [];
  const out: MaterialBox[] = [];
  for (const item of valor) {
    if (!item || typeof item !== "object") continue;
    const { material, perBox } = item as { material?: unknown; perBox?: unknown };
    if (typeof material !== "string" || !material.trim()) continue;
    const n = Number(perBox);
    if (!Number.isInteger(n) || n <= 0) continue;
    out.push({ material: material.trim(), perBox: n });
  }
  return out;
}

/**
 * Arma la lista de materiales desde el formulario (dos columnas paralelas: nombre y cantidad).
 * Las filas vacías se ignoran; una fila con nombre y sin cantidad válida es un error.
 */
export function materialesDesdeFormulario(
  nombres: readonly string[],
  cantidades: readonly string[],
): { ok: true; materiales: MaterialBox[] } | { ok: false; error: string } {
  const materiales: MaterialBox[] = [];
  for (let i = 0; i < nombres.length; i++) {
    const material = (nombres[i] ?? "").trim();
    const texto = (cantidades[i] ?? "").trim();
    if (!material && !texto) continue;
    if (!material) return { ok: false, error: `Falta el nombre del material de la fila ${i + 1}.` };
    if (material.length > 200) return { ok: false, error: `El material de la fila ${i + 1} es demasiado largo.` };
    const n = Number(texto);
    if (!Number.isInteger(n) || n <= 0 || n > 1000) {
      return { ok: false, error: `La cantidad por caja de «${material}» tiene que ser un número entero mayor que cero.` };
    }
    materiales.push({ material, perBox: n });
  }
  return { ok: true, materiales };
}

export type CajaConMateriales = { id: string; number: number; name: string; materials: MaterialBox[] };

export type PreparacionBox = {
  /** Por caja: cuántas hacen falta y cuánto de cada material (cantidad por caja × cajas). */
  porCaja: {
    caja: CajaConMateriales;
    cantidad: number;
    materiales: (MaterialBox & { total: number })[];
  }[];
  /** Todos los materiales sumados, para armar la compra. Mismo nombre (sin importar mayúsculas) = misma fila. */
  totales: { material: string; total: number }[];
  totalCajas: number;
};

/**
 * Lo que hay que armar ahora: a partir de las cajas que le faltan a cada persona, cuántas cajas
 * de cada BOX y el total de cada material. Como la hoja «Para 10 cajas», pero con las cantidades
 * reales del mes.
 */
export function prepararCajas(
  porEnviar: readonly (readonly { id: string }[])[],
  cajas: readonly CajaConMateriales[],
): PreparacionBox {
  const cuenta = new Map<string, number>();
  for (const lista of porEnviar) for (const c of lista) cuenta.set(c.id, (cuenta.get(c.id) ?? 0) + 1);

  const porCaja = cajas
    .filter((c) => (cuenta.get(c.id) ?? 0) > 0)
    .sort((a, b) => a.number - b.number)
    .map((caja) => {
      const cantidad = cuenta.get(caja.id) ?? 0;
      return {
        caja,
        cantidad,
        materiales: caja.materials.map((m) => ({ ...m, total: m.perBox * cantidad })),
      };
    });

  const totales = new Map<string, { material: string; total: number }>();
  for (const fila of porCaja) {
    for (const m of fila.materiales) {
      const clave = m.material.trim().toLocaleLowerCase("es");
      const previo = totales.get(clave);
      if (previo) previo.total += m.total;
      else totales.set(clave, { material: m.material, total: m.total });
    }
  }

  return {
    porCaja,
    totales: [...totales.values()].sort((a, b) => a.material.localeCompare(b.material, "es")),
    totalCajas: porCaja.reduce((s, f) => s + f.cantidad, 0),
  };
}

// ---------------------------------------------------------------------------------------------
// Dirección de envío
// ---------------------------------------------------------------------------------------------

export type DireccionEnvio = {
  address: string;
  city: string | null;
  province: string | null;
  postalCode: string | null;
};

const limpio = (s: string | null | undefined) => (s?.trim() ? s.trim() : null);

/**
 * La dirección a la que se manda la caja, copiada del socio. `null` si no tiene calle o
 * localidad: sin eso el correo no puede entregar, y sólo hay envío a domicilio.
 */
export function direccionDeEnvio(socio: {
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
}): DireccionEnvio | null {
  const address = limpio(socio.address);
  const city = limpio(socio.city);
  if (!address || !city) return null;
  return { address, city, province: limpio(socio.province), postalCode: limpio(socio.postalCode) };
}

/** «Av. Siempreviva 742, Rafaela, Santa Fe (CP 2300)». */
export function direccionLegible(d: {
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
}): string {
  const partes = [limpio(d.address), limpio(d.city), limpio(d.province)].filter(Boolean).join(", ");
  const cp = limpio(d.postalCode);
  return cp ? `${partes} (CP ${cp})` : partes;
}
