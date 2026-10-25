/**
 * Análisis de ventas: horas pico, mejores días, productos, categorías y vendedores. Módulo PURO,
 * en centavos y en hora de Argentina (UTC−3, sin horario de verano).
 *
 * Una "venta" es lo que se cobró en el mostrador (venta común) o un pedido (no cancelado), por
 * la fecha en que se cargó. Los importes son el precio de venta de cada renglón.
 */

export type RenglonAnalisis = { productId: string | null; nombre: string; categoria: string; unidades: number; importeMinor: number };

export type VentaAnalisis = { fecha: Date; totalMinor: number; vendedorId: number | null; renglones: RenglonAnalisis[] };

export const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;

export type Celda = { cantidad: number; importeMinor: number };
export type Fila = { clave: string; nombre: string; unidades: number; importeMinor: number; ventas: number };

export type Analisis = {
  ventas: number;
  totalMinor: number;
  ticketPromedioMinor: number;
  /** [día de la semana, lunes = 0][hora 0–23]. */
  mapa: Celda[][];
  porDia: Celda[];
  porHora: Celda[];
  mejoresFechas: { fecha: string; cantidad: number; importeMinor: number }[];
  productos: Fila[];
  categorias: Fila[];
  vendedores: { vendedorId: number | null; ventas: number; importeMinor: number }[];
};

const AR_MS = 3 * 3_600_000;

/** Día de la semana (lunes = 0), hora y fecha "aaaa-mm-dd" en Argentina. */
export function enArgentina(d: Date): { dia: number; hora: number; fecha: string } {
  const ar = new Date(d.getTime() - AR_MS);
  return { dia: (ar.getUTCDay() + 6) % 7, hora: ar.getUTCHours(), fecha: ar.toISOString().slice(0, 10) };
}

const celda = (): Celda => ({ cantidad: 0, importeMinor: 0 });

function sumarFila(m: Map<string, Fila>, clave: string, nombre: string, unidades: number, importeMinor: number) {
  const f = m.get(clave) ?? { clave, nombre, unidades: 0, importeMinor: 0, ventas: 0 };
  f.unidades += unidades;
  f.importeMinor += importeMinor;
  f.ventas += 1;
  m.set(clave, f);
}

const porImporte = (a: { importeMinor: number }, b: { importeMinor: number }) => b.importeMinor - a.importeMinor;

export function analizar(ventas: readonly VentaAnalisis[]): Analisis {
  const mapa = Array.from({ length: 7 }, () => Array.from({ length: 24 }, celda));
  const porDia = Array.from({ length: 7 }, celda);
  const porHora = Array.from({ length: 24 }, celda);
  const fechas = new Map<string, { fecha: string; cantidad: number; importeMinor: number }>();
  const productos = new Map<string, Fila>();
  const categorias = new Map<string, Fila>();
  const vendedores = new Map<number | null, { vendedorId: number | null; ventas: number; importeMinor: number }>();
  let totalMinor = 0;

  for (const v of ventas) {
    const { dia, hora, fecha } = enArgentina(v.fecha);
    for (const c of [mapa[dia]![hora]!, porDia[dia]!, porHora[hora]!]) {
      c.cantidad += 1;
      c.importeMinor += v.totalMinor;
    }
    const f = fechas.get(fecha) ?? { fecha, cantidad: 0, importeMinor: 0 };
    f.cantidad += 1;
    f.importeMinor += v.totalMinor;
    fechas.set(fecha, f);
    totalMinor += v.totalMinor;
    const vend = vendedores.get(v.vendedorId) ?? { vendedorId: v.vendedorId, ventas: 0, importeMinor: 0 };
    vend.ventas += 1;
    vend.importeMinor += v.totalMinor;
    vendedores.set(v.vendedorId, vend);
    for (const r of v.renglones) {
      sumarFila(productos, r.productId ?? `suelto:${r.nombre}`, r.nombre, r.unidades, r.importeMinor);
      sumarFila(categorias, r.categoria, r.categoria, r.unidades, r.importeMinor);
    }
  }

  return {
    ventas: ventas.length,
    totalMinor,
    ticketPromedioMinor: ventas.length ? Math.round(totalMinor / ventas.length) : 0,
    mapa,
    porDia,
    porHora,
    mejoresFechas: [...fechas.values()].sort(porImporte).slice(0, 5),
    productos: [...productos.values()].sort(porImporte),
    categorias: [...categorias.values()].sort(porImporte),
    vendedores: [...vendedores.values()].sort(porImporte),
  };
}

/** Escalón 0–5 de un valor contra el máximo, para el mapa de calor (0 = sin ventas). */
export function escalon(valor: number, maximo: number): number {
  if (valor <= 0 || maximo <= 0) return 0;
  return Math.min(5, Math.max(1, Math.ceil((valor / maximo) * 5)));
}
