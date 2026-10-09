import "server-only";
import { prisma } from "@repo/db";
import { hoyEnBuenosAires } from "@/lib/listado/periodos";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { decimalArsToMinor } from "@/lib/membership/money";
import { nombreDeContacto } from "@/lib/pedidos/nombre-contacto";
import { fechaDeBase } from "@/lib/pedidos/plan";
import { validarItem, type ItemPresupuesto } from "@/lib/presupuestos/constantes";
import { puedeVerInformes, type CtxInformes } from "./acceso";
import { AVISO_DEMASIADOS_DATOS, MAX_FILAS_CUOTAS_Y_CUENTAS } from "./constantes";
import { MAX_FILAS_DETALLE, fechaDeInstante, totalDeFilas } from "./detalle";
import { etiquetaMes, inicioDeMes, inicioDelMesSiguiente, periodoInforme, type PeriodoInforme } from "./periodos";
import {
  AVISO_DESCUENTO_GLOBAL,
  ETIQUETAS_AGRUPAMIENTO,
  agrupamientoElegido,
  armarVentas,
  detalleDeVentas,
  leerFiltroVentas,
  type AgrupamientoVentas,
  type FilaDetalleVentas,
  type FiltroVentas,
  type MatrizVentas,
  type PedidoVenta,
} from "./ventas";

/**
 * Lectura de Ventas (etapa 6, Entrega B). Cada consulta filtra por `workspaceId`. El tope (20 000
 * pedidos) se mide leyendo uno más: si se pasa, no se devuelven datos parciales sino el aviso.
 * Los cancelados quedan afuera. Se lee por fecha de confirmación (`createdAt`, hora de Buenos Aires).
 */

const NOMBRES_CLIENTE = { firstName: true, lastName: true, businessName: true } as const;

/** Ítems del JSON del pedido; un renglón que no valida se saltea (los demás se cuentan). */
function itemsDeJson(raw: unknown): ItemPresupuesto[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x) => {
    const v = validarItem(x);
    return v.ok ? [v.valor] : [];
  });
}

/** Pedidos no cancelados confirmados entre los meses `desde` y `hasta`, con los nombres resueltos. `null` si se pasa el tope. */
export async function leerPedidosVenta(workspaceId: string, desde: string, hasta: string): Promise<PedidoVenta[] | null> {
  const filas = await prisma.fotofficePedido.findMany({
    where: {
      workspaceId,
      status: { not: "CANCELADO" },
      createdAt: { gte: inicioDeMes(desde), lt: inicioDelMesSiguiente(hasta) },
    },
    select: {
      id: true, number: true, createdAt: true, eventDate: true, totalArs: true, items: true, clientId: true, ownerUserId: true,
      client: { select: NOMBRES_CLIENTE },
      consultaLead: { select: { fotofficeConsulta: { select: { categoryId: true, originId: true } } } },
    },
    orderBy: { createdAt: "asc" },
    take: MAX_FILAS_CUOTAS_Y_CUENTAS + 1,
  });
  if (filas.length > MAX_FILAS_CUOTAS_Y_CUENTAS) return null;

  const idsCategoria = [...new Set(filas.flatMap((p) => p.consultaLead?.fotofficeConsulta?.categoryId ?? []))];
  const idsOrigen = [...new Set(filas.flatMap((p) => p.consultaLead?.fotofficeConsulta?.originId ?? []))];
  const idsUsuario = [...new Set(filas.flatMap((p) => (p.ownerUserId === null ? [] : [p.ownerUserId])))];
  const [categorias, origenes, usuarios] = await Promise.all([
    idsCategoria.length > 0 ? prisma.fotofficeConsultaCategoria.findMany({ where: { workspaceId, id: { in: idsCategoria } }, select: { id: true, name: true } }) : [],
    idsOrigen.length > 0 ? prisma.fotofficeOrigen.findMany({ where: { workspaceId, id: { in: idsOrigen } }, select: { id: true, name: true } }) : [],
    // Los usuarios no tienen workspace: sólo se piden los que figuran como responsables de pedidos de este workspace.
    idsUsuario.length > 0 ? prisma.user.findMany({ where: { id: { in: idsUsuario } }, select: { id: true, name: true, email: true } }) : [],
  ]);
  const nombreCategoria = new Map(categorias.map((c) => [c.id, c.name]));
  const nombreOrigen = new Map(origenes.map((o) => [o.id, o.name]));
  const nombreUsuario = new Map(usuarios.map((u) => [u.id, etiquetaDeUsuario(u)]));

  return filas.map((p) => {
    const consulta = p.consultaLead?.fotofficeConsulta ?? null;
    return {
      id: p.id,
      numero: p.number,
      confirmadoEn: p.createdAt,
      fechaEvento: p.eventDate ? fechaDeBase(p.eventDate) : null,
      totalCentavos: decimalArsToMinor(p.totalArs),
      items: itemsDeJson(p.items),
      clienteId: p.clientId,
      cliente: nombreDeContacto(p.client),
      vendedorId: p.ownerUserId,
      vendedor: p.ownerUserId === null ? "" : (nombreUsuario.get(p.ownerUserId) ?? `Usuario ${p.ownerUserId}`),
      tieneConsulta: consulta !== null,
      categoriaId: consulta?.categoryId ?? null,
      categoria: consulta ? (nombreCategoria.get(consulta.categoryId) ?? null) : null,
      origenId: consulta?.originId ?? null,
      origen: consulta?.originId ? (nombreOrigen.get(consulta.originId) ?? null) : null,
    };
  });
}

export type VentasCargadas = {
  periodo: PeriodoInforme;
  agrupar: AgrupamientoVentas;
  /** `null` si se pasó el tope de datos (no se muestran datos parciales). */
  matriz: MatrizVentas | null;
  /** Cuántos pedidos se leyeron (0 = nada en el período). */
  cantidadPedidos: number;
  avisos: string[];
};

/** Ventas por grupo y mes. `null` si la persona no tiene permiso (no se lee nada). */
export async function cargarVentas(
  ctx: CtxInformes,
  params: { periodo?: string | null; agrupar?: string | null } = {},
  ahora: Date = new Date(),
): Promise<VentasCargadas | null> {
  if (!puedeVerInformes(ctx)) return null;
  const periodo = periodoInforme({ periodo: params.periodo, hoy: hoyEnBuenosAires(ahora) });
  const agrupar = agrupamientoElegido(params.agrupar);
  const avisos = periodo.aviso ? [periodo.aviso] : [];
  const pedidos = await leerPedidosVenta(ctx.workspaceId, periodo.desde, periodo.hasta);
  if (!pedidos) return { periodo, agrupar, matriz: null, cantidadPedidos: 0, avisos: [...avisos, AVISO_DEMASIADOS_DATOS] };
  if (agrupar === "producto") avisos.push(AVISO_DESCUENTO_GLOBAL);
  return { periodo, agrupar, matriz: armarVentas({ pedidos, meses: periodo.meses, agrupar }), cantidadPedidos: pedidos.length, avisos };
}

export type DetalleVentas = {
  titulo: string;
  periodo: PeriodoInforme;
  filtro: FiltroVentas;
  filas: FilaDetalleVentas[];
  /** Todas las filas de la celda (el CSV las trae completas; la pantalla dibuja `filas`). */
  todas: FilaDetalleVentas[];
  cantidad: number;
  total: number;
  truncado: boolean;
  /** Sólo "demasiados datos" (con avisos no hay filas). */
  avisos: string[];
  /** Aclaración que acompaña al desglose (descuento global en Producto). */
  nota: string | null;
  volver: string;
};

/** El desglose de una celda de Ventas. `null` si no hay permiso o la celda de la dirección no es válida. */
export async function cargarDetalleVentas(
  ctx: CtxInformes,
  params: Record<string, string | string[] | undefined>,
  ahora: Date = new Date(),
): Promise<DetalleVentas | null> {
  if (!puedeVerInformes(ctx)) return null;
  const pe = params.periodo;
  const periodo = periodoInforme({ periodo: Array.isArray(pe) ? pe[0] : pe, hoy: hoyEnBuenosAires(ahora) });
  const filtro = leerFiltroVentas(params, periodo.meses);
  if (!filtro) return null;
  const volver = `/informes/ventas?${new URLSearchParams({ agrupar: filtro.agrupar, periodo: periodo.valor }).toString()}`;
  const cuando = filtro.mes ? etiquetaMes(filtro.mes) : periodo.etiqueta;
  const base = { periodo, filtro, volver };
  const vacio = (titulo: string, avisos: string[]): DetalleVentas => ({ ...base, titulo, filas: [], todas: [], cantidad: 0, total: 0, truncado: false, avisos, nota: null });

  // Con un mes elegido sólo se lee ese mes.
  const pedidos = await leerPedidosVenta(ctx.workspaceId, filtro.mes ?? periodo.desde, filtro.mes ?? periodo.hasta);
  if (!pedidos) return vacio(`${ETIQUETAS_AGRUPAMIENTO[filtro.agrupar]} · ${cuando}`, [AVISO_DEMASIADOS_DATOS]);
  const { filas: todas, etiqueta } = detalleDeVentas(pedidos, filtro, fechaDeInstante);
  const titulo = [etiqueta ?? "Sin movimientos", cuando].join(" · ");
  return {
    ...base,
    titulo,
    filas: todas.slice(0, MAX_FILAS_DETALLE),
    todas,
    cantidad: todas.length,
    total: totalDeFilas(todas),
    truncado: todas.length > MAX_FILAS_DETALLE,
    avisos: [],
    nota: filtro.agrupar === "producto" ? AVISO_DESCUENTO_GLOBAL : null,
  };
}
