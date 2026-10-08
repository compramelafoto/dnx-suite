import "server-only";
import Link from "next/link";
import { prisma, type Prisma } from "@repo/db";
import { claseDeColorEtiqueta } from "@/lib/ficha/formato";
import { TOPE_IDS_POR_CONSULTA } from "@/lib/listado/presupuesto";
import type { ConsultaResuelta, ContextoListado, DefinicionListado, Opcion } from "@/lib/listado/tipos";
import { diaEnBuenosAires } from "@/lib/presupuestos/estados";
import { ESTADOS_PEDIDO, ETIQUETA_ESTADO_PEDIDO, esEstadoPedido, type EstadoPedido } from "./constantes";
import { resumenDePlan } from "./estado";
import { pesosDeBase, planesDe } from "./plan";
import { completarFilas, SELECT_PEDIDO, type FilaPedido } from "./pedidos";

/**
 * Lista de Pedidos sobre el motor de listas (0.2). Columnas: número, contacto, evento, estado,
 * total, cobrado, saldo y próximo vencimiento. Filtros: estado, con saldo y con cuotas vencidas.
 * Nunca lee costos.
 *
 * "Con saldo" y "con vencidas" no se pueden escribir en un `where` de Prisma (el saldo sale de
 * las imputaciones de cobros sin anular): se calculan con el plan de los pedidos abiertos del
 * workspace y viajan como lista de ids. Si son más que el tope, la lista sale vacía con un aviso,
 * nunca parcial.
 */

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
const TOPE_ABIERTOS = TOPE_IDS_POR_CONSULTA;

export const AVISO_DEMASIADOS_PEDIDOS = "Hay demasiados pedidos abiertos para filtrar por saldo o vencidas. Filtrá antes por estado o buscá un número.";

export const OPCIONES_ESTADO_PEDIDO: readonly Opcion[] = ESTADOS_PEDIDO.map((e) => ({ valor: e, etiqueta: ETIQUETA_ESTADO_PEDIDO[e] }));

const COLOR_ESTADO: Record<EstadoPedido, string> = {
  CONFIRMADO: "azul",
  EN_CURSO: "violeta",
  COMPLETADO: "verde",
  CANCELADO: "gris",
};

export function claseDeEstadoPedido(e: EstadoPedido): string {
  return claseDeColorEtiqueta(COLOR_ESTADO[e]);
}

type Calculados = { excedido: true } | { excedido: false; conSaldo: string[]; conVencidas: string[] };

/** Pedidos abiertos (no cancelados) con saldo y con cuotas vencidas, por id. */
async function calcularSaldos(workspaceId: string, ahora: Date): Promise<Calculados> {
  const abiertos = await prisma.fotofficePedido.findMany({
    where: { workspaceId, status: { in: ["CONFIRMADO", "EN_CURSO", "COMPLETADO"] } },
    select: { id: true, status: true, totalArs: true },
    take: TOPE_ABIERTOS + 1,
  });
  if (abiertos.length > TOPE_ABIERTOS) return { excedido: true };
  const hoy = diaEnBuenosAires(ahora);
  const planes = await planesDe(workspaceId, abiertos.map((p) => p.id));
  const conSaldo: string[] = [];
  const conVencidas: string[] = [];
  for (const p of abiertos) {
    if (!esEstadoPedido(p.status)) continue;
    const plan = planes.get(p.id) ?? { cuotas: [], imputaciones: [] };
    const r = resumenDePlan(plan.cuotas, plan.imputaciones, { hoy, estadoPedido: p.status, total: pesosDeBase(p.totalArs) });
    if (r.aCobrar > 0) conSaldo.push(p.id);
    if (r.cuotasVencidas > 0) conVencidas.push(p.id);
  }
  return { excedido: false, conSaldo, conVencidas };
}

function usaSaldos(c: ConsultaResuelta): boolean {
  return c.filtros.saldo === "si" || c.filtros.saldo === "no" || c.filtros.vencidas === "si" || c.filtros.vencidas === "no";
}

/** Puro: lo que se le pide a Prisma. `workspaceId` va siempre. */
export function wherePedidos(workspaceId: string, c: ConsultaResuelta, calculados: Calculados | null): Prisma.FotofficePedidoWhereInput {
  if (calculados?.excedido) return { workspaceId, id: { in: [] } };
  const and: Prisma.FotofficePedidoWhereInput[] = [];
  const q = c.q.trim().replace(/^(n\s*[°º]|nro\.?)\s*/i, "").trim();
  if (q) {
    const contiene = { contains: q, mode: "insensitive" as const };
    and.push({
      OR: [
        { number: contiene },
        { eventLabel: contiene },
        { client: { is: { firstName: contiene } } },
        { client: { is: { lastName: contiene } } },
        { client: { is: { businessName: contiene } } },
      ],
    });
  }
  const estado = c.filtros.estado;
  if (estado && esEstadoPedido(estado)) and.push({ status: estado });
  if (calculados && !calculados.excedido) {
    if (c.filtros.saldo === "si") and.push({ id: { in: calculados.conSaldo } });
    else if (c.filtros.saldo === "no") and.push({ NOT: { id: { in: calculados.conSaldo } } });
    if (c.filtros.vencidas === "si") and.push({ id: { in: calculados.conVencidas } });
    else if (c.filtros.vencidas === "no") and.push({ NOT: { id: { in: calculados.conVencidas } } });
  }
  return and.length > 0 ? { workspaceId, AND: and } : { workspaceId };
}

async function resolverWhere(ctx: ContextoListado, c: ConsultaResuelta): Promise<Prisma.FotofficePedidoWhereInput> {
  const calculados = usaSaldos(c) ? await calcularSaldos(ctx.workspaceId, new Date()) : null;
  return wherePedidos(ctx.workspaceId, c, calculados);
}

function ordenarPor(c: ConsultaResuelta): Prisma.FotofficePedidoOrderByWithRelationInput[] {
  const dir = c.orden.desc ? "desc" : "asc";
  switch (c.orden.campo) {
    case "evento":
      return [{ eventDate: { sort: dir, nulls: "last" } }, { id: dir }];
    case "actualizado":
      return [{ updatedAt: dir }, { id: dir }];
    default:
      return [{ createdAt: dir }, { id: dir }];
  }
}

async function filasPorIds(workspaceId: string, ids: string[]): Promise<FilaPedido[]> {
  const validos = ids.filter((id) => ID_VALIDO.test(id));
  if (validos.length === 0) return [];
  const filas = await prisma.fotofficePedido.findMany({ where: { workspaceId, id: { in: validos } }, select: SELECT_PEDIDO });
  const porId = new Map((await completarFilas(workspaceId, filas, new Date())).map((f) => [f.id, f]));
  return validos.flatMap((id) => porId.get(id) ?? []);
}

const pesos = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Math.round(n));
const fecha = (ymd: string | null) => (ymd ? ymd.split("-").reverse().join("/") : "—");

export const listadoPedidos: DefinicionListado<FilaPedido> = {
  clave: "pedidos",
  titulo: "Pedidos",
  sustantivo: { singular: "pedido", plural: "pedidos" },
  placeholderBusqueda: "Buscar por número, contacto o evento",
  columnas: [
    {
      clave: "numero",
      titulo: "N°",
      celda: (f) => (
        <Link href={`/pedidos/${encodeURIComponent(f.id)}`} className="whitespace-nowrap font-medium tabular-nums text-[var(--fo-text)] hover:underline">
          {f.numero}
        </Link>
      ),
    },
    {
      clave: "contacto",
      titulo: "Contacto",
      celda: (f) => (
        <Link href={`/clientes/${encodeURIComponent(f.clientId)}`} className="text-[var(--fo-text)] hover:underline">
          {f.contacto}
        </Link>
      ),
    },
    {
      clave: "evento",
      titulo: "Evento",
      orden: "evento",
      celda: (f) => (
        <span>
          {fecha(f.eventDate)}
          {f.eventLabel ? <span className="block text-xs text-[var(--fo-muted)]">{f.eventLabel}</span> : null}
        </span>
      ),
    },
    {
      clave: "estado",
      titulo: "Estado",
      celda: (f) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${claseDeEstadoPedido(f.estado)}`}>{ETIQUETA_ESTADO_PEDIDO[f.estado]}</span>,
    },
    { clave: "total", titulo: "Total", alinear: "derecha", celda: (f) => <span className="whitespace-nowrap tabular-nums">{pesos(f.total)}</span> },
    { clave: "cobrado", titulo: "Cobrado", alinear: "derecha", celda: (f) => <span className="whitespace-nowrap tabular-nums">{pesos(f.cobrado)}</span> },
    {
      clave: "saldo",
      titulo: "Saldo",
      alinear: "derecha",
      celda: (f) => <span className={`whitespace-nowrap tabular-nums ${f.vencido > 0 ? "font-medium text-[var(--fo-danger)]" : ""}`}>{pesos(f.aCobrar)}</span>,
    },
    { clave: "vence", titulo: "Próximo vencimiento", celda: (f) => fecha(f.proximoVencimiento) },
  ],
  filtros: [
    { tipo: "opcion", clave: "estado", etiqueta: "Estado", opciones: OPCIONES_ESTADO_PEDIDO },
    { tipo: "siNo", clave: "saldo", etiqueta: "Saldo", si: "Con saldo", no: "Sin saldo" },
    { tipo: "siNo", clave: "vencidas", etiqueta: "Cuotas vencidas", si: "Con vencidas", no: "Sin vencidas" },
  ],
  ordenes: ["alta", "evento", "actualizado"],
  ordenPorDefecto: { campo: "alta", desc: true },
  idDe: (f) => f.id,
  hrefFicha: (id) => `/pedidos/${encodeURIComponent(id)}`,
  contar: async (ctx, c) => prisma.fotofficePedido.count({ where: await resolverWhere(ctx, c) }),
  traer: async (ctx, c, { skip, take }) => {
    const filas = await prisma.fotofficePedido.findMany({ where: await resolverWhere(ctx, c), select: SELECT_PEDIDO, orderBy: ordenarPor(c), skip, take });
    return completarFilas(ctx.workspaceId, filas, new Date());
  },
  traerIds: async (ctx, c, tope) => {
    const filas = await prisma.fotofficePedido.findMany({ where: await resolverWhere(ctx, c), select: { id: true }, orderBy: ordenarPor(c), take: tope });
    return filas.map((f) => f.id);
  },
  traerPorIds: async (ctx, ids) => filasPorIds(ctx.workspaceId, ids),
  aviso: async (ctx, c) => (usaSaldos(c) && (await calcularSaldos(ctx.workspaceId, new Date())).excedido ? AVISO_DEMASIADOS_PEDIDOS : null),
  acciones: [],
  exportar: {
    columnas: [
      { titulo: "N°", tipo: "texto", valor: (f) => f.numero },
      { titulo: "Contacto", tipo: "texto", valor: (f) => f.contacto },
      { titulo: "Fecha del evento", tipo: "texto", valor: (f) => fecha(f.eventDate) },
      { titulo: "Evento", tipo: "texto", valor: (f) => f.eventLabel },
      { titulo: "Estado", tipo: "texto", valor: (f) => ETIQUETA_ESTADO_PEDIDO[f.estado] },
      { titulo: "Total", tipo: "importe", valor: (f) => f.total },
      { titulo: "Cobrado", tipo: "importe", valor: (f) => f.cobrado },
      { titulo: "Saldo", tipo: "importe", valor: (f) => f.aCobrar },
      { titulo: "Próximo vencimiento", tipo: "texto", valor: (f) => fecha(f.proximoVencimiento) },
      { titulo: "Alta", tipo: "fechaHora", valor: (f) => f.createdAt },
    ],
  },
};
