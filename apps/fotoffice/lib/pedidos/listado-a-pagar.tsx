import "server-only";
import Link from "next/link";
import { prisma, type Prisma } from "@repo/db";
import { clientDisplayName } from "@/lib/clients/display";
import { claseDeColorEtiqueta } from "@/lib/ficha/formato";
import type { ConsultaResuelta, DefinicionListado, Opcion } from "@/lib/listado/tipos";
import { diaEnBuenosAires } from "@/lib/presupuestos/estados";
import {
  COLOR_ESTADO_CUENTA,
  ETIQUETA_ESTADO_CUENTA,
  ETIQUETA_SITUACION_A_PAGAR,
  SITUACIONES_A_PAGAR,
  esSituacionAPagar,
  estadoDeCuenta,
  sumarDiasAFecha,
  type EstadoCuenta,
} from "./cuentas-pagar-estado";
import { fechaDeBase, fechaParaBase, pesosDeBase } from "./plan";

/**
 * "A pagar" (Entrega B1) sobre el motor de listas: las cuentas a pagar del workspace con proveedor,
 * concepto, pedido, vencimiento, importe y estado. Filtros: situación (vencidas, próximos 30 días,
 * todas las pendientes o pagadas) y proveedor. Todo es dinero de costos: el registro de listas sólo
 * la entrega con `veCostosDePedido` (`lib/listado/registro.ts`) y la página la vuelve a pedir.
 */

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
/** Días de "próximos": de hoy a hoy + 30 (hora de Argentina). */
export const DIAS_PROXIMOS = 30;

export type FilaCuentaPagar = {
  id: string;
  concepto: string;
  proveedorId: string | null;
  proveedor: string | null;
  pedidoId: string | null;
  pedidoNumero: string | null;
  /** "aaaa-mm-dd" o null. */
  vence: string | null;
  importe: number;
  estado: EstadoCuenta;
  createdAt: Date;
};

export const OPCIONES_SITUACION: readonly Opcion[] = SITUACIONES_A_PAGAR.map((s) => ({ valor: s, etiqueta: ETIQUETA_SITUACION_A_PAGAR[s] }));

/** Puro: lo que se le pide a Prisma. `workspaceId` va siempre; `hoy` es el día de Argentina. */
export function whereCuentasPagar(workspaceId: string, c: ConsultaResuelta, hoy: string): Prisma.FotofficeCuentaPagarWhereInput {
  const and: Prisma.FotofficeCuentaPagarWhereInput[] = [];
  const q = c.q.trim();
  if (q) {
    const contiene = { contains: q, mode: "insensitive" as const };
    const numero = q.replace(/^(n\s*[°º]|nro\.?)\s*/i, "").trim() || q;
    and.push({
      OR: [
        { concept: contiene },
        { pedido: { is: { number: { contains: numero, mode: "insensitive" } } } },
        { supplier: { is: { firstName: contiene } } },
        { supplier: { is: { lastName: contiene } } },
        { supplier: { is: { businessName: contiene } } },
      ],
    });
  }
  const s = c.filtros.situacion;
  if (esSituacionAPagar(s)) {
    if (s === "pagadas") and.push({ paidAt: { not: null } });
    else and.push({ paidAt: null });
    if (s === "vencidas") and.push({ dueDate: { lt: fechaParaBase(hoy) } });
    if (s === "proximos30") and.push({ dueDate: { gte: fechaParaBase(hoy), lte: fechaParaBase(sumarDiasAFecha(hoy, DIAS_PROXIMOS)) } });
  }
  const proveedor = c.filtros.proveedor;
  if (proveedor && ID_VALIDO.test(proveedor)) and.push({ supplierClientId: proveedor });
  return and.length > 0 ? { workspaceId, AND: and } : { workspaceId };
}

function ordenarPor(c: ConsultaResuelta): Prisma.FotofficeCuentaPagarOrderByWithRelationInput[] {
  const dir = c.orden.desc ? "desc" : "asc";
  switch (c.orden.campo) {
    case "importe":
      return [{ amountArs: dir }, { id: dir }];
    case "alta":
      return [{ createdAt: dir }, { id: dir }];
    default:
      return [{ dueDate: { sort: dir, nulls: "last" } }, { id: dir }];
  }
}

const SELECT = {
  id: true,
  workspaceId: true,
  concept: true,
  supplierClientId: true,
  pedidoId: true,
  amountArs: true,
  dueDate: true,
  paidAt: true,
  createdAt: true,
  supplier: { select: { workspaceId: true, kind: true, firstName: true, lastName: true, businessName: true } },
  pedido: { select: { workspaceId: true, number: true } },
} as const;

type FilaBase = Prisma.FotofficeCuentaPagarGetPayload<{ select: typeof SELECT }>;

function aFila(f: FilaBase, hoy: string): FilaCuentaPagar {
  const vence = f.dueDate ? fechaDeBase(f.dueDate) : null;
  // Sólo los datos del mismo workspace (las FKs ya lo aseguran; es un resguardo).
  const proveedor = f.supplier && f.supplier.workspaceId === f.workspaceId ? f.supplier : null;
  const pedido = f.pedido && f.pedido.workspaceId === f.workspaceId ? f.pedido : null;
  return {
    id: f.id,
    concepto: f.concept,
    proveedorId: proveedor ? f.supplierClientId : null,
    proveedor: proveedor ? clientDisplayName(proveedor) : null,
    pedidoId: pedido ? f.pedidoId : null,
    pedidoNumero: pedido?.number ?? null,
    vence,
    importe: pesosDeBase(f.amountArs),
    estado: estadoDeCuenta({ pagada: f.paidAt !== null, vence }, hoy),
    createdAt: f.createdAt,
  };
}

const pesos = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fecha = (ymd: string | null) => (ymd ? ymd.split("-").reverse().join("/") : "Sin vencimiento");

async function filasPorIds(workspaceId: string, ids: string[]): Promise<FilaCuentaPagar[]> {
  const validos = ids.filter((id) => ID_VALIDO.test(id));
  if (validos.length === 0) return [];
  const hoy = diaEnBuenosAires(new Date());
  const filas = await prisma.fotofficeCuentaPagar.findMany({ where: { workspaceId, id: { in: validos } }, select: SELECT });
  const porId = new Map(filas.map((f) => [f.id, aFila(f, hoy)]));
  return validos.flatMap((id) => porId.get(id) ?? []);
}

export const listadoAPagar: DefinicionListado<FilaCuentaPagar> = {
  clave: "pedidos-a-pagar",
  titulo: "A pagar",
  sustantivo: { singular: "cuenta a pagar", plural: "cuentas a pagar" },
  placeholderBusqueda: "Buscar por concepto, proveedor o número de pedido",
  columnas: [
    { clave: "proveedor", titulo: "Proveedor", celda: (f) => f.proveedor ?? <span className="text-[var(--fo-muted)]">Sin proveedor</span> },
    { clave: "concepto", titulo: "Concepto", celda: (f) => f.concepto },
    {
      clave: "pedido",
      titulo: "Pedido",
      celda: (f) =>
        f.pedidoId && f.pedidoNumero ? (
          <Link href={`/pedidos/${encodeURIComponent(f.pedidoId)}#costos`} className="whitespace-nowrap tabular-nums text-[var(--fo-text)] hover:underline">
            N° {f.pedidoNumero}
          </Link>
        ) : (
          "—"
        ),
    },
    { clave: "vence", titulo: "Vencimiento", orden: "vence", celda: (f) => <span className="whitespace-nowrap">{fecha(f.vence)}</span> },
    { clave: "importe", titulo: "Importe", orden: "importe", alinear: "derecha", celda: (f) => <span className="whitespace-nowrap tabular-nums">{pesos(f.importe)}</span> },
    {
      clave: "estado",
      titulo: "Estado",
      celda: (f) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${claseDeColorEtiqueta(COLOR_ESTADO_CUENTA[f.estado])}`}>{ETIQUETA_ESTADO_CUENTA[f.estado]}</span>
      ),
    },
  ],
  filtros: [
    { tipo: "opcion", clave: "situacion", etiqueta: "Situación", opciones: OPCIONES_SITUACION },
    { tipo: "relacion", clave: "proveedor", etiqueta: "Proveedor", conBuscador: true },
  ],
  ordenes: ["vence", "importe", "alta"],
  ordenPorDefecto: { campo: "vence", desc: false },
  idDe: (f) => f.id,
  // Una cuenta no tiene ficha propia: lleva a la de su pedido.
  hrefFicha: (id) => `/pedidos/a-pagar/${encodeURIComponent(id)}`,
  contar: async (ctx, c) => prisma.fotofficeCuentaPagar.count({ where: whereCuentasPagar(ctx.workspaceId, c, diaEnBuenosAires(new Date())) }),
  traer: async (ctx, c, { skip, take }) => {
    const hoy = diaEnBuenosAires(new Date());
    const filas = await prisma.fotofficeCuentaPagar.findMany({ where: whereCuentasPagar(ctx.workspaceId, c, hoy), select: SELECT, orderBy: ordenarPor(c), skip, take });
    return filas.map((f) => aFila(f, hoy));
  },
  traerIds: async (ctx, c, tope) => {
    const filas = await prisma.fotofficeCuentaPagar.findMany({
      where: whereCuentasPagar(ctx.workspaceId, c, diaEnBuenosAires(new Date())),
      select: { id: true },
      orderBy: ordenarPor(c),
      take: tope,
    });
    return filas.map((f) => f.id);
  },
  traerPorIds: async (ctx, ids) => filasPorIds(ctx.workspaceId, ids),
  buscarRelacion: async (ctx, clave, texto) => {
    if (clave !== "proveedor") return [];
    const q = texto.trim();
    if (!q) return [];
    const contiene = { contains: q, mode: "insensitive" as const };
    const clientes = await prisma.client.findMany({
      where: { workspaceId: ctx.workspaceId, OR: [{ firstName: contiene }, { lastName: contiene }, { businessName: contiene }] },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { businessName: "asc" }, { id: "asc" }],
      take: 20,
      select: { id: true, kind: true, firstName: true, lastName: true, businessName: true },
    });
    return clientes.map((c) => ({ valor: c.id, etiqueta: clientDisplayName(c) }));
  },
  validarRelacion: async (ctx, clave, id) => {
    if (clave !== "proveedor" || !ID_VALIDO.test(id)) return null;
    const c = await prisma.client.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { kind: true, firstName: true, lastName: true, businessName: true } });
    return c ? clientDisplayName(c) : null;
  },
  acciones: [],
  exportar: {
    columnas: [
      { titulo: "Proveedor", tipo: "texto", valor: (f) => f.proveedor },
      { titulo: "Concepto", tipo: "texto", valor: (f) => f.concepto },
      { titulo: "Pedido", tipo: "texto", valor: (f) => f.pedidoNumero },
      { titulo: "Vencimiento", tipo: "texto", valor: (f) => (f.vence ? fecha(f.vence) : null) },
      { titulo: "Importe", tipo: "importe", valor: (f) => f.importe },
      { titulo: "Estado", tipo: "texto", valor: (f) => ETIQUETA_ESTADO_CUENTA[f.estado] },
      { titulo: "Alta", tipo: "fechaHora", valor: (f) => f.createdAt },
    ],
  },
};
