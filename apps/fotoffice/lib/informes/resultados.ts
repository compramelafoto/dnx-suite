/**
 * Resultados por rubro y mes (etapa 6). Módulo PURO: recibe filas ya leídas (sin Prisma) y devuelve
 * la matriz en centavos enteros.
 *
 * Reglas (de la spec):
 * - Bloque por código del rubro: 3 = Ingresos, 4 = Costos, 5 = Gastos; lo demás, "Sin clasificar".
 *   Un hijo sin código hereda el bloque del padre.
 * - Un asiento de un lado que no corresponde al bloque de su rubro (un egreso en un rubro de
 *   ingresos, o al revés) va a "Sin clasificar" de su propio lado: así no infla el otro lado.
 * - Resultado = Ingresos − Costos − Gastos + Sin clasificar de ingreso − Sin clasificar de egreso.
 */
import { compararCodigos } from "@/lib/rubros/rubros";
import { diaEnBuenosAires } from "./fechas";
import { bloqueDeRubro, ladoDeBloque, type BloqueResultado } from "./bloques";
import { MODULOS_CAJA_DE_PEDIDOS } from "./constantes";
import { mesDeDia } from "./periodos";

export type Lado = "INGRESO" | "EGRESO";

export type RubroInfo = {
  id: string;
  nombre: string;
  codigo: string | null;
  parentId: string | null;
  activo: boolean;
};

/** Un importe que cae en un mes y un rubro. `signo` es -1 sólo en las anulaciones. */
export type Asiento = { mes: string; categoryId: string | null; kind: Lado; centavos: number; signo: 1 | -1 };

export type ClaveBloque = BloqueResultado | "SIN_CLASIFICAR_INGRESO" | "SIN_CLASIFICAR_EGRESO";

export type FilaRubro = {
  categoryId: string | null;
  nombre: string;
  codigo: string | null;
  inactivo: boolean;
  /** Un valor por cada mes de la matriz, en el mismo orden. Un padre incluye a sus hijos. */
  porMes: number[];
  total: number;
  hijos: FilaRubro[];
};

export type BloqueMatriz = {
  clave: ClaveBloque;
  titulo: string;
  filas: FilaRubro[];
  porMes: number[];
  total: number;
};

export type MatrizResultados = {
  meses: string[];
  bloques: BloqueMatriz[];
  /** Fila final: Ingresos − Costos − Gastos + Sin clasificar ingreso − Sin clasificar egreso. */
  resultado: { porMes: number[]; total: number };
  /** Hay importes (distintos de cero) en alguno de los dos "Sin clasificar". */
  haySinClasificar: boolean;
};

const TITULOS: Record<ClaveBloque, string> = {
  INGRESOS: "Ingresos",
  COSTOS: "Costos",
  GASTOS: "Gastos",
  SIN_CLASIFICAR_INGRESO: "Sin clasificar (ingresos)",
  SIN_CLASIFICAR_EGRESO: "Sin clasificar (egresos)",
};
const ORDEN: ClaveBloque[] = ["INGRESOS", "COSTOS", "GASTOS", "SIN_CLASIFICAR_INGRESO", "SIN_CLASIFICAR_EGRESO"];

export const NOMBRE_SIN_RUBRO = "Sin rubro";
export const NOMBRE_RUBRO_DESCONOCIDO = "Rubro no encontrado";

const ceros = (n: number) => Array.from({ length: n }, () => 0);
const sumar = (a: number[], b: readonly number[]) => a.forEach((_, i) => (a[i] += b[i]));

export function armarResultados(entrada: { meses: string[]; rubros: RubroInfo[]; asientos: Asiento[] }): MatrizResultados {
  const { meses, rubros, asientos } = entrada;
  const indiceMes = new Map(meses.map((m, i) => [m, i]));
  const porId = new Map(rubros.map((r) => [r.id, r]));
  const n = meses.length;

  // 1. Importe por (clave de rubro) y mes, ya con signo. La clave "" es "sin rubro".
  type Celda = { bloque: ClaveBloque; porMes: number[] };
  const acumulado = new Map<string, Celda>();
  for (const a of asientos) {
    const i = indiceMes.get(a.mes);
    if (i === undefined) continue;
    const rubro = a.categoryId ? porId.get(a.categoryId) : undefined;
    const bloqueRubro = rubro ? bloqueDeRubro(rubro, porId) : null;
    const lado = a.kind;
    const bloque: ClaveBloque =
      bloqueRubro !== null && ladoDeBloque(bloqueRubro) === lado
        ? bloqueRubro
        : lado === "INGRESO"
          ? "SIN_CLASIFICAR_INGRESO"
          : "SIN_CLASIFICAR_EGRESO";
    const clave = `${bloque}|${a.categoryId ?? ""}`;
    let celda = acumulado.get(clave);
    if (!celda) acumulado.set(clave, (celda = { bloque, porMes: ceros(n) }));
    celda.porMes[i] += a.centavos * a.signo;
  }

  // 2. Rubros que se muestran en cada bloque: los activos del bloque por código, más los que
  //    tuvieron movimientos. El "sin clasificar" muestra sólo los que tuvieron movimientos.
  const aMostrar = new Map<ClaveBloque, Map<string, number[]>>(ORDEN.map((c) => [c, new Map()]));
  for (const r of rubros) {
    const b = bloqueDeRubro(r, porId);
    if (b !== null && r.activo) aMostrar.get(b)!.set(r.id, ceros(n));
  }
  for (const [clave, celda] of acumulado) {
    const id = clave.slice(clave.indexOf("|") + 1);
    const destino = aMostrar.get(celda.bloque)!;
    const actual = destino.get(id) ?? ceros(n);
    sumar(actual, celda.porMes);
    destino.set(id, actual);
  }

  // 3. Filas por bloque, agrupadas por padre con subtotal.
  const bloques: BloqueMatriz[] = ORDEN.map((clave) => {
    const propios = aMostrar.get(clave)!;
    const fila = (id: string, porMes: number[]): FilaRubro => {
      const r = id === "" ? undefined : porId.get(id);
      return {
        categoryId: id === "" ? null : id,
        nombre: id === "" ? NOMBRE_SIN_RUBRO : (r?.nombre ?? NOMBRE_RUBRO_DESCONOCIDO),
        codigo: r?.codigo ?? null,
        inactivo: r ? !r.activo : false,
        porMes: [...porMes],
        total: porMes.reduce((s, v) => s + v, 0),
        hijos: [],
      };
    };

    const padreDe = (id: string): string | null => {
      const r = id === "" ? undefined : porId.get(id);
      const p = r?.parentId && r.parentId !== r.id ? r.parentId : null;
      // Se agrupa bajo el padre sólo si el padre existe y es de este mismo bloque (o hay que mostrarlo).
      return p && porId.has(p) ? p : null;
    };

    const grupos = new Map<string, FilaRubro>();
    const hijosPorPadre = new Map<string, FilaRubro[]>();
    const sueltas: FilaRubro[] = [];
    for (const [id, porMes] of propios) {
      const f = fila(id, porMes);
      const p = padreDe(id);
      if (p === null) {
        grupos.set(id, f);
        sueltas.push(f);
      } else {
        const l = hijosPorPadre.get(p) ?? [];
        l.push(f);
        hijosPorPadre.set(p, l);
      }
    }
    for (const [p, hijos] of hijosPorPadre) {
      let g = grupos.get(p);
      if (!g) {
        g = fila(p, ceros(n));
        grupos.set(p, g);
        sueltas.push(g);
      }
      hijos.sort((a, b) => compararCodigos(a.codigo, b.codigo) || a.nombre.localeCompare(b.nombre, "es"));
      g.hijos = hijos;
      for (const h of hijos) {
        sumar(g.porMes, h.porMes);
        g.total += h.total;
      }
    }
    sueltas.sort((a, b) => compararCodigos(a.codigo, b.codigo) || a.nombre.localeCompare(b.nombre, "es"));

    const porMes = ceros(n);
    for (const g of sueltas) sumar(porMes, g.porMes);
    return { clave, titulo: TITULOS[clave], filas: sueltas, porMes, total: porMes.reduce((s, v) => s + v, 0) };
  });

  const b = (c: ClaveBloque) => bloques.find((x) => x.clave === c)!;
  const resultadoPorMes = meses.map(
    (_, i) =>
      b("INGRESOS").porMes[i] - b("COSTOS").porMes[i] - b("GASTOS").porMes[i] + b("SIN_CLASIFICAR_INGRESO").porMes[i] - b("SIN_CLASIFICAR_EGRESO").porMes[i],
  );
  const haySinClasificar = [b("SIN_CLASIFICAR_INGRESO"), b("SIN_CLASIFICAR_EGRESO")].some((x) => x.porMes.some((v) => v !== 0));
  return {
    meses,
    bloques,
    resultado: { porMes: resultadoPorMes, total: resultadoPorMes.reduce((s, v) => s + v, 0) },
    haySinClasificar,
  };
}

// --- Asientos ------------------------------------------------------------------------------------

/** Un movimiento de Caja, ya leído (importe en centavos). */
export type MovimientoCajaFila = {
  id: string;
  occurredAt: Date;
  kind: Lado;
  centavos: number;
  categoryId: string | null;
  transferId: string | null;
  reversesMovementId: string | null;
  sourceModule: string;
};

/** El movimiento original de una anulación (puede venir de otro mes, fuera del lote). */
export type MovimientoOriginal = {
  id: string;
  kind: Lado;
  categoryId: string | null;
  transferId?: string | null;
  sourceModule?: string;
};

/**
 * Asientos de la base "cobrado y pagado". Excluye las patas de transferencias; una anulación resta
 * (`signo` -1) en el mes en que se anuló, pero en el bloque, rubro y lado del movimiento original.
 * `originales` trae los originales que no estén en `movs`; los que sí estén se usan directamente.
 */
export function asientosDeCaja(
  movs: readonly MovimientoCajaFila[],
  originales: Iterable<MovimientoOriginal> = [],
  opciones: { excluirModulos?: readonly string[] } = {},
): Asiento[] {
  const excluidos = new Set(opciones.excluirModulos ?? []);
  const porId = new Map<string, MovimientoOriginal>();
  for (const o of originales) porId.set(o.id, o);
  for (const m of movs) porId.set(m.id, m);

  const out: Asiento[] = [];
  for (const m of movs) {
    if (m.transferId !== null) continue;
    const mes = mesDeDia(diaEnBuenosAires(m.occurredAt));
    if (m.reversesMovementId === null) {
      if (excluidos.has(m.sourceModule)) continue;
      out.push({ mes, categoryId: m.categoryId, kind: m.kind, centavos: m.centavos, signo: 1 });
      continue;
    }
    const original = porId.get(m.reversesMovementId);
    if (original) {
      if (original.transferId) continue;
      if (excluidos.has(original.sourceModule ?? m.sourceModule)) continue;
      out.push({ mes, categoryId: original.categoryId, kind: original.kind, centavos: m.centavos, signo: -1 });
    } else {
      // Sin el original a mano: el contramovimiento es del lado contrario, así que se resta del lado opuesto.
      if (excluidos.has(m.sourceModule)) continue;
      out.push({ mes, categoryId: m.categoryId, kind: m.kind === "INGRESO" ? "EGRESO" : "INGRESO", centavos: m.centavos, signo: -1 });
    }
  }
  return out;
}

export type PedidoFila = {
  status: string;
  /** "AAAA-MM-DD" o `null`. */
  eventDate: string | null;
  createdAt: Date;
  centavos: number;
  incomeCategoryId: string | null;
};

export type CuentaPagarFila = {
  dueDate: string | null;
  createdAt: Date;
  centavos: number;
  costCategoryId: string | null;
};

/**
 * Asientos de la base "vendido y comprometido": pedidos no cancelados (ingreso, por fecha del evento
 * o de creación), todas las cuentas a pagar (egreso, por vencimiento o creación) y los movimientos de
 * Caja que no vienen de pedidos ni de pagos de pedidos (esos ya están contados arriba).
 */
export function asientosDevengados(entrada: {
  pedidos: readonly PedidoFila[];
  cuentas: readonly CuentaPagarFila[];
  movs: readonly MovimientoCajaFila[];
  originales?: Iterable<MovimientoOriginal>;
}): Asiento[] {
  const out: Asiento[] = [];
  for (const p of entrada.pedidos) {
    if (p.status === "CANCELADO") continue;
    const dia = p.eventDate ?? diaEnBuenosAires(p.createdAt);
    out.push({ mes: mesDeDia(dia), categoryId: p.incomeCategoryId, kind: "INGRESO", centavos: p.centavos, signo: 1 });
  }
  for (const c of entrada.cuentas) {
    const dia = c.dueDate ?? diaEnBuenosAires(c.createdAt);
    out.push({ mes: mesDeDia(dia), categoryId: c.costCategoryId, kind: "EGRESO", centavos: c.centavos, signo: 1 });
  }
  out.push(...asientosDeCaja(entrada.movs, entrada.originales ?? [], { excluirModulos: MODULOS_CAJA_DE_PEDIDOS }));
  return out;
}
