/**
 * Ventas (etapa 6, Entrega B). Módulo PURO: agrupa pedidos por producto, cliente, vendedor,
 * categoría u origen y arma la matriz grupo × meses. La lectura vive en `ventas-datos.ts`.
 *
 * Reglas:
 * - el mes de un pedido es el de su fecha de confirmación (`createdAt`, hora de Buenos Aires);
 * - por producto, el importe de cada ítem sale de `calcularTotales` (la misma cuenta que usa el
 *   presupuesto: cantidad × precio − descuento del ítem). Los ítems OPCIONALES no suman: el pedido
 *   guarda los ítems de la versión aceptada tal cual, con su marca `opcional`, y su total
 *   (`totalArs`) los deja afuera, así que acá también quedan afuera;
 * - el descuento global NO se prorratea entre ítems (la pantalla lo avisa);
 * - en los demás agrupamientos el importe es el `totalArs` del pedido.
 */
import type { ItemPresupuesto } from "@/lib/presupuestos/constantes";
import { calcularTotales } from "@/lib/presupuestos/totales";
import { mesDeInstante } from "./periodos";

export const AGRUPAMIENTOS_VENTAS = ["producto", "cliente", "vendedor", "categoria", "origen"] as const;
export type AgrupamientoVentas = (typeof AGRUPAMIENTOS_VENTAS)[number];
export const AGRUPAMIENTO_VENTAS_POR_OMISION: AgrupamientoVentas = "producto";

export const ETIQUETAS_AGRUPAMIENTO: Record<AgrupamientoVentas, string> = {
  producto: "Producto",
  cliente: "Cliente",
  vendedor: "Vendedor",
  categoria: "Categoría",
  origen: "Origen",
};

export const AVISO_DESCUENTO_GLOBAL =
  "Los descuentos globales de cada presupuesto no se reparten entre los productos: la suma por producto puede dar más que el total de los pedidos. Los ítems opcionales no se cuentan.";

export const SIN_VENDEDOR = "Sin vendedor";
export const SIN_CONSULTA = "Sin consulta";
export const SIN_CATALOGO = "sin producto del catálogo";

export function agrupamientoElegido(v: unknown): AgrupamientoVentas {
  return (AGRUPAMIENTOS_VENTAS as readonly string[]).includes(v as string) ? (v as AgrupamientoVentas) : AGRUPAMIENTO_VENTAS_POR_OMISION;
}

/** Un pedido ya leído, con los nombres resueltos. */
export type PedidoVenta = {
  id: string;
  numero: string;
  /** Fecha de confirmación (instante). */
  confirmadoEn: Date;
  /** "AAAA-MM-DD" o `null`. */
  fechaEvento: string | null;
  totalCentavos: number;
  items: readonly ItemPresupuesto[];
  clienteId: string;
  cliente: string;
  vendedorId: number | null;
  vendedor: string;
  tieneConsulta: boolean;
  categoriaId: string | null;
  categoria: string | null;
  origenId: string | null;
  origen: string | null;
};

export type FilaVentas = {
  clave: string;
  etiqueta: string;
  /** Importe por mes, en el orden de `meses`. */
  porMes: number[];
  /** Unidades (producto) o pedidos (resto) por mes. */
  cantidadPorMes: number[];
  total: number;
  cantidad: number;
};

export type MatrizVentas = {
  agrupar: AgrupamientoVentas;
  meses: string[];
  filas: FilaVentas[];
  totalPorMes: number[];
  cantidadPorMes: number[];
  total: number;
  cantidad: number;
  /** "Unidades" o "Pedidos". */
  unidad: string;
};

/** Una línea del desglose: el pedido y lo que aporta al grupo. */
export type FilaDetalleVentas = {
  clave: string;
  pedidoId: string;
  numero: string;
  /** "AAAA-MM-DD" (día de Buenos Aires). */
  confirmado: string;
  cliente: string;
  fechaEvento: string | null;
  categoria: string;
  vendedor: string;
  centavos: number;
};

/** Importe de un ítem en centavos, con la cuenta de `totales.ts` (un ítem solo, sin descuento global). */
export function centavosDeItem(item: ItemPresupuesto): number {
  const t = calcularTotales([item], null);
  return Math.round((t.renglones[item.id]?.neto ?? 0) * 100);
}

type Aporte = { clave: string; etiqueta: string; centavos: number; cantidad: number };

const norm = (s: string) => s.trim().toLowerCase();

/** Lo que un pedido aporta a cada grupo del agrupamiento (el producto puede dar varios; el resto, uno). */
export function aportesDePedido(p: PedidoVenta, agrupar: AgrupamientoVentas): Aporte[] {
  switch (agrupar) {
    case "producto": {
      const porClave = new Map<string, Aporte>();
      for (const it of p.items) {
        if (it.opcional) continue;
        const clave = it.productId ? `p:${it.productId}` : `n:${norm(it.nombre)}`;
        const etiqueta = it.productId ? it.nombre : `${it.nombre} (${SIN_CATALOGO})`;
        const a = porClave.get(clave) ?? { clave, etiqueta, centavos: 0, cantidad: 0 };
        a.centavos += centavosDeItem(it);
        a.cantidad += Number.isFinite(it.cantidad) ? Math.max(0, it.cantidad) : 0;
        porClave.set(clave, a);
      }
      return [...porClave.values()];
    }
    case "cliente":
      return [{ clave: `c:${p.clienteId}`, etiqueta: p.cliente, centavos: p.totalCentavos, cantidad: 1 }];
    case "vendedor":
      return [p.vendedorId === null ? { clave: "sin", etiqueta: SIN_VENDEDOR, centavos: p.totalCentavos, cantidad: 1 } : { clave: `u:${p.vendedorId}`, etiqueta: p.vendedor, centavos: p.totalCentavos, cantidad: 1 }];
    case "categoria":
      return [!p.tieneConsulta ? { clave: "sin", etiqueta: SIN_CONSULTA, centavos: p.totalCentavos, cantidad: 1 } : { clave: `k:${p.categoriaId}`, etiqueta: p.categoria ?? "Sin categoría", centavos: p.totalCentavos, cantidad: 1 }];
    case "origen":
      if (!p.tieneConsulta) return [{ clave: "sin", etiqueta: SIN_CONSULTA, centavos: p.totalCentavos, cantidad: 1 }];
      return [p.origenId === null ? { clave: "sin-origen", etiqueta: "Sin origen", centavos: p.totalCentavos, cantidad: 1 } : { clave: `o:${p.origenId}`, etiqueta: p.origen ?? "Sin origen", centavos: p.totalCentavos, cantidad: 1 }];
  }
}

/** Matriz grupo × meses. Los pedidos fuera de `meses` se ignoran. Orden: mayor total primero. */
export function armarVentas(params: { pedidos: readonly PedidoVenta[]; meses: readonly string[]; agrupar: AgrupamientoVentas }): MatrizVentas {
  const { pedidos, meses, agrupar } = params;
  const indice = new Map(meses.map((m, i) => [m, i]));
  const filas = new Map<string, FilaVentas>();
  const totalPorMes = meses.map(() => 0);
  const cantidadPorMes = meses.map(() => 0);
  // Del más viejo al más nuevo: el nombre que queda es el último que tuvo el producto.
  const ordenados = [...pedidos].sort((a, b) => a.confirmadoEn.getTime() - b.confirmadoEn.getTime());
  for (const p of ordenados) {
    const i = indice.get(mesDeInstante(p.confirmadoEn));
    if (i === undefined) continue;
    for (const a of aportesDePedido(p, agrupar)) {
      const f = filas.get(a.clave) ?? { clave: a.clave, etiqueta: a.etiqueta, porMes: meses.map(() => 0), cantidadPorMes: meses.map(() => 0), total: 0, cantidad: 0 };
      f.etiqueta = a.etiqueta;
      f.porMes[i] += a.centavos;
      f.cantidadPorMes[i] += a.cantidad;
      f.total += a.centavos;
      f.cantidad += a.cantidad;
      filas.set(a.clave, f);
      totalPorMes[i] += a.centavos;
      cantidadPorMes[i] += a.cantidad;
    }
  }
  const lista = [...filas.values()].sort((a, b) => b.total - a.total || a.etiqueta.localeCompare(b.etiqueta, "es"));
  return {
    agrupar,
    meses: [...meses],
    filas: lista,
    totalPorMes,
    cantidadPorMes,
    total: totalPorMes.reduce((s, v) => s + v, 0),
    cantidad: cantidadPorMes.reduce((s, v) => s + v, 0),
    unidad: agrupar === "producto" ? "Unidades" : "Pedidos",
  };
}

// --- Desglose -------------------------------------------------------------------------------------

export type FiltroVentas = {
  agrupar: AgrupamientoVentas;
  /** Clave del grupo (`FilaVentas.clave`). */
  grupo: string;
  /** "AAAA-MM", o `null` para todo el período. */
  mes: string | null;
};

type Params = Record<string, string | string[] | undefined>;

function texto(v: string | string[] | undefined): string | null {
  const t = Array.isArray(v) ? v[0] : v;
  return typeof t === "string" && t.trim() !== "" ? t.trim() : null;
}

/** Lee la celda de la dirección; `null` si falta el grupo o es demasiado largo. El mes se acepta sólo si está en el período. */
export function leerFiltroVentas(sp: Params, mesesDelPeriodo: readonly string[]): FiltroVentas | null {
  const grupo = texto(sp.grupo);
  if (!grupo || grupo.length > 300) return null;
  const mes = texto(sp.mes);
  return { agrupar: agrupamientoElegido(texto(sp.agrupar)), grupo, mes: mes && mesesDelPeriodo.includes(mes) ? mes : null };
}

export function paramsDeCeldaVentas(f: FiltroVentas, periodo: string): URLSearchParams {
  const p = new URLSearchParams({ agrupar: f.agrupar, periodo, grupo: f.grupo });
  if (f.mes) p.set("mes", f.mes);
  return p;
}

/** Las líneas (una por pedido) que forman una celda, de la más vieja a la más nueva. */
export function detalleDeVentas(pedidos: readonly PedidoVenta[], f: FiltroVentas, fechaDe: (d: Date) => string): { filas: FilaDetalleVentas[]; etiqueta: string | null } {
  const filas: FilaDetalleVentas[] = [];
  let etiqueta: string | null = null;
  for (const p of pedidos) {
    if (f.mes !== null && mesDeInstante(p.confirmadoEn) !== f.mes) continue;
    const a = aportesDePedido(p, f.agrupar).find((x) => x.clave === f.grupo);
    if (!a) continue;
    etiqueta = a.etiqueta;
    filas.push({
      clave: p.id,
      pedidoId: p.id,
      numero: p.numero,
      confirmado: fechaDe(p.confirmadoEn),
      cliente: p.cliente,
      fechaEvento: p.fechaEvento,
      categoria: p.tieneConsulta ? (p.categoria ?? "Sin categoría") : SIN_CONSULTA,
      vendedor: p.vendedorId === null ? SIN_VENDEDOR : p.vendedor,
      centavos: a.centavos,
    });
  }
  filas.sort((a, b) => (a.confirmado < b.confirmado ? -1 : a.confirmado > b.confirmado ? 1 : a.clave < b.clave ? -1 : a.clave > b.clave ? 1 : 0));
  return { filas, etiqueta };
}
