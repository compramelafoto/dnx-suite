import "server-only";
import Link from "next/link";
import { prisma, type Prisma } from "@repo/db";
import { claseDeColorEtiqueta } from "@/lib/ficha/formato";
import type { AccionLote, ConsultaResuelta, ContextoListado, DefinicionListado, Opcion } from "@/lib/listado/tipos";
import { numeroDe } from "@/lib/numeracion/asignar";
import { responsablesDe } from "@/lib/circuitos/tablero";
import { TIPO_CONSULTA } from "@/lib/service-leads/numero";
import type { CtxPresupuestos } from "./acceso";
import { ENTIDAD_NUMERACION, ESTADOS_PRESUPUESTO, ETIQUETA_ESTADO, esEstadoPresupuesto, type EstadoPresupuesto } from "./constantes";
import { estadoEfectivo, ESTADOS_QUE_VENCEN, hoyEnBuenosAires, textoDeFecha } from "./estados";
import { marcarVencidos } from "./presupuestos";

/**
 * Lista de Presupuestos sobre el motor de listas (0.2). Columnas: número, contacto, consulta,
 * estado, total, vence y responsable. Filtros: estado, vencidos y responsable. Lote: "Marcar
 * vencidos". Nunca lee costos: el total es el de la versión vigente.
 *
 * El estado VENCIDO se calcula al leer (`estadoEfectivo`): un enviado o visto cuyo último día ya
 * pasó cuenta como vencido aunque la base todavía diga ENVIADO, y los filtros lo respetan.
 */

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
const TOPE_NUMERO = 20_000;

export type FilaListaPresupuesto = {
  id: string;
  numero: string | null;
  estado: EstadoPresupuesto;
  /** El estado guardado (el lote mira éste). */
  estadoGuardado: EstadoPresupuesto;
  clientId: string;
  contacto: string;
  consultaLeadId: string;
  consulta: string;
  total: number;
  /** "aaaa-mm-dd". */
  validUntil: string | null;
  responsable: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const SELECT_FILA = {
  id: true,
  status: true,
  validUntil: true,
  ownerUserId: true,
  clientId: true,
  consultaLeadId: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { firstName: true, lastName: true, businessName: true } },
  consultaLead: { select: { name: true } },
  currentVersion: { select: { totals: true } },
} satisfies Prisma.FotofficePresupuestoSelect;

type FilaBase = Prisma.FotofficePresupuestoGetPayload<{ select: typeof SELECT_FILA }>;

export const OPCIONES_ESTADO: readonly Opcion[] = ESTADOS_PRESUPUESTO.map((e) => ({ valor: e, etiqueta: ETIQUETA_ESTADO[e] }));

const COLOR_ESTADO: Record<EstadoPresupuesto, string> = {
  BORRADOR: "gris",
  ENVIADO: "azul",
  VISTO: "violeta",
  ACEPTADO: "verde",
  RECHAZADO: "rojo",
  VENCIDO: "naranja",
};

export function claseDeEstado(e: EstadoPresupuesto): string {
  return claseDeColorEtiqueta(COLOR_ESTADO[e]);
}

/** Puro: el `where` de "vencido" (marcado, o enviado/visto con el último día ya pasado). */
export function whereVencido(hoy: Date): Prisma.FotofficePresupuestoWhereInput {
  return { OR: [{ status: "VENCIDO" }, { status: { in: [...ESTADOS_QUE_VENCEN] }, validUntil: { lt: hoy } }] };
}

/** Puro: el `where` de un estado EFECTIVO. */
export function whereEstado(estado: EstadoPresupuesto, hoy: Date): Prisma.FotofficePresupuestoWhereInput {
  if (estado === "VENCIDO") return whereVencido(hoy);
  if (ESTADOS_QUE_VENCEN.includes(estado)) return { status: estado, OR: [{ validUntil: null }, { validUntil: { gte: hoy } }] };
  return { status: estado };
}

/**
 * Puro: lo que se le pide a Prisma. `workspaceId` va siempre. `idsNumero`: presupuestos cuyo
 * número contiene lo buscado (se suma al OR de la búsqueda).
 */
export function wherePresupuestos(workspaceId: string, c: ConsultaResuelta, ahora: Date, idsNumero: string[] = []): Prisma.FotofficePresupuestoWhereInput {
  const hoy = hoyEnBuenosAires(ahora);
  const and: Prisma.FotofficePresupuestoWhereInput[] = [];
  const q = c.q.trim();
  if (q) {
    const contiene = { contains: q, mode: "insensitive" as const };
    const or: Prisma.FotofficePresupuestoWhereInput[] = [
      { client: { is: { firstName: contiene } } },
      { client: { is: { lastName: contiene } } },
      { client: { is: { businessName: contiene } } },
      { consultaLead: { is: { name: contiene } } },
    ];
    if (idsNumero.length > 0) or.push({ id: { in: idsNumero } });
    and.push({ OR: or });
  }
  const estado = c.filtros.estado;
  if (estado && esEstadoPresupuesto(estado)) and.push(whereEstado(estado, hoy));
  if (c.filtros.vencidos === "si") and.push(whereVencido(hoy));
  else if (c.filtros.vencidos === "no") and.push({ NOT: whereVencido(hoy) });
  const responsable = Number(c.filtros.responsable);
  if (c.filtros.responsable && Number.isSafeInteger(responsable) && responsable > 0) and.push({ ownerUserId: responsable });
  return and.length > 0 ? { workspaceId, AND: and } : { workspaceId };
}

/** Presupuestos cuyo número mostrado contiene lo buscado (si son demasiados, no suma nada). */
async function idsPorNumero(workspaceId: string, q: string): Promise<string[]> {
  const t = q.trim().replace(/^(n\s*[°º]|nro\.?)\s*/i, "").trim();
  if (!/\d/.test(t)) return [];
  const filas = await prisma.fotofficeRecordNumber.findMany({
    where: { workspaceId, entityType: ENTIDAD_NUMERACION, display: { contains: t, mode: "insensitive" } },
    select: { entityId: true },
    take: TOPE_NUMERO + 1,
  });
  return filas.length > TOPE_NUMERO ? [] : filas.map((f) => f.entityId);
}

async function resolverWhere(ctx: ContextoListado, c: ConsultaResuelta): Promise<Prisma.FotofficePresupuestoWhereInput> {
  return wherePresupuestos(ctx.workspaceId, c, new Date(), await idsPorNumero(ctx.workspaceId, c.q));
}

function ordenarPor(c: ConsultaResuelta): Prisma.FotofficePresupuestoOrderByWithRelationInput[] {
  const dir = c.orden.desc ? "desc" : "asc";
  switch (c.orden.campo) {
    case "vence":
      return [{ validUntil: { sort: dir, nulls: "last" } }, { id: dir }];
    case "alta":
      return [{ createdAt: dir }, { id: dir }];
    default:
      return [{ updatedAt: dir }, { id: dir }];
  }
}

export function nombreDeContacto(c: { firstName: string | null; lastName: string | null; businessName: string | null } | null | undefined): string {
  if (!c) return "Sin nombre";
  return c.businessName?.trim() || [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "Sin nombre";
}

function totalDe(totals: unknown): number {
  const t = (totals as { total?: unknown } | null)?.total;
  return typeof t === "number" && Number.isFinite(t) ? t : 0;
}

async function completar(workspaceId: string, filas: FilaBase[]): Promise<FilaListaPresupuesto[]> {
  const ahora = new Date();
  const [numeros, numerosConsulta, equipo] = await Promise.all([
    numeroDe(workspaceId, ENTIDAD_NUMERACION, filas.map((f) => f.id)),
    numeroDe(workspaceId, TIPO_CONSULTA, filas.map((f) => f.consultaLeadId)),
    filas.some((f) => f.ownerUserId !== null) ? responsablesDe(workspaceId) : Promise.resolve([]),
  ]);
  const nombres = new Map(equipo.map((r) => [r.id, r.nombre]));
  const out: FilaListaPresupuesto[] = [];
  for (const f of filas) {
    if (!esEstadoPresupuesto(f.status)) continue;
    const numeroConsulta = numerosConsulta.get(f.consultaLeadId);
    out.push({
      id: f.id,
      numero: numeros.get(f.id) ?? null,
      estado: estadoEfectivo(f.status, f.validUntil, ahora),
      estadoGuardado: f.status,
      clientId: f.clientId,
      contacto: nombreDeContacto(f.client),
      consultaLeadId: f.consultaLeadId,
      consulta: numeroConsulta ? `N° ${numeroConsulta}` : f.consultaLead?.name || "Consulta",
      total: totalDe(f.currentVersion?.totals),
      validUntil: textoDeFecha(f.validUntil),
      responsable: f.ownerUserId === null ? null : (nombres.get(f.ownerUserId) ?? `Usuario ${f.ownerUserId}`),
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    });
  }
  return out;
}

async function filasPorIds(workspaceId: string, ids: string[]): Promise<FilaListaPresupuesto[]> {
  const validos = ids.filter((id) => ID_VALIDO.test(id));
  if (validos.length === 0) return [];
  const filas = await prisma.fotofficePresupuesto.findMany({ where: { workspaceId, id: { in: validos } }, select: SELECT_FILA });
  const porId = new Map((await completar(workspaceId, filas)).map((f) => [f.id, f]));
  return validos.flatMap((id) => porId.get(id) ?? []);
}

const pesos = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Math.round(n));
const fecha = (ymd: string | null) => (ymd ? ymd.split("-").reverse().join("/") : "—");

/** El contexto de Presupuestos que arma el lote desde el del listado (mismo acceso resuelto). */
function ctxDePresupuestos(ctx: ContextoListado): CtxPresupuestos {
  return { workspaceId: ctx.workspaceId, userId: ctx.userId, userLabel: ctx.userLabel, role: ctx.role, acceso: ctx.acceso };
}

export const MOTIVO_NO_VENCIDO = "No está vencido o ya está marcado.";

export const ACCION_MARCAR_VENCIDOS: AccionLote = {
  clave: "marcar-vencidos",
  etiqueta: "Marcar vencidos",
  capacidad: "operar",
  maximo: 500,
  confirmacion: "Vas a marcar como vencidos {n} presupuestos.",
  elegibles: async (ctx, ids) => {
    const hoy = hoyEnBuenosAires(new Date());
    const filas = ids.length
      ? await prisma.fotofficePresupuesto.findMany({
          where: { workspaceId: ctx.workspaceId, id: { in: ids } },
          select: { id: true, status: true, validUntil: true },
        })
      : [];
    const vence = new Set(
      filas.filter((f) => ESTADOS_QUE_VENCEN.includes(f.status as EstadoPresupuesto) && f.validUntil !== null && f.validUntil < hoy).map((f) => f.id),
    );
    return {
      elegibles: ids.filter((id) => vence.has(id)),
      excluidos: ids.filter((id) => !vence.has(id)).map((id) => ({ id, motivo: MOTIVO_NO_VENCIDO })),
    };
  },
  aplicar: async (ctx, ids) => {
    const r = await marcarVencidos(ctxDePresupuestos(ctx), ids);
    if (!r.ok) return { aplicados: 0, fallidos: ids.map((id) => ({ id, error: r.error })), detalle: [] };
    return { aplicados: r.marcados, fallidos: [], detalle: [{ ids, despues: "VENCIDO" }] };
  },
};

export const listadoPresupuestos: DefinicionListado<FilaListaPresupuesto> = {
  clave: "presupuestos",
  titulo: "Presupuestos",
  sustantivo: { singular: "presupuesto", plural: "presupuestos" },
  placeholderBusqueda: "Buscar por número, contacto o consulta",
  columnas: [
    {
      clave: "numero",
      titulo: "N°",
      celda: (f) => (
        <Link href={`/presupuestos/${encodeURIComponent(f.id)}`} className="whitespace-nowrap font-medium tabular-nums text-[var(--fo-text)] hover:underline">
          {f.numero ?? "Borrador"}
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
      clave: "consulta",
      titulo: "Consulta",
      celda: (f) => (
        <Link href={`/consultas/${encodeURIComponent(f.consultaLeadId)}`} className="text-[var(--fo-text)] hover:underline">
          {f.consulta}
        </Link>
      ),
    },
    {
      clave: "estado",
      titulo: "Estado",
      celda: (f) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${claseDeEstado(f.estado)}`}>{ETIQUETA_ESTADO[f.estado]}</span>,
    },
    { clave: "total", titulo: "Total", alinear: "derecha", celda: (f) => <span className="whitespace-nowrap tabular-nums">{pesos(f.total)}</span> },
    {
      clave: "vence",
      titulo: "Vence",
      orden: "vence",
      celda: (f) => <span className={f.estado === "VENCIDO" ? "font-medium text-red-700" : undefined}>{fecha(f.validUntil)}</span>,
    },
    { clave: "responsable", titulo: "Responsable", celda: (f) => f.responsable ?? "—" },
    { clave: "actualizado", titulo: "Último cambio", orden: "actualizado", secundaria: true, celda: (f) => f.updatedAt.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) },
  ],
  filtros: [
    { tipo: "opcion", clave: "estado", etiqueta: "Estado", opciones: OPCIONES_ESTADO },
    { tipo: "siNo", clave: "vencidos", etiqueta: "Vencidos", si: "Vencidos", no: "Sin vencer" },
    { tipo: "relacion", clave: "responsable", etiqueta: "Responsable" },
  ],
  ordenes: ["actualizado", "vence", "alta"],
  ordenPorDefecto: { campo: "actualizado", desc: true },
  idDe: (f) => f.id,
  hrefFicha: (id) => `/presupuestos/${encodeURIComponent(id)}`,
  contar: async (ctx, c) => prisma.fotofficePresupuesto.count({ where: await resolverWhere(ctx, c) }),
  traer: async (ctx, c, { skip, take }) => {
    const filas = await prisma.fotofficePresupuesto.findMany({ where: await resolverWhere(ctx, c), select: SELECT_FILA, orderBy: ordenarPor(c), skip, take });
    return completar(ctx.workspaceId, filas);
  },
  traerIds: async (ctx, c, tope) => {
    const filas = await prisma.fotofficePresupuesto.findMany({ where: await resolverWhere(ctx, c), select: { id: true }, orderBy: ordenarPor(c), take: tope });
    return filas.map((f) => f.id);
  },
  traerPorIds: async (ctx, ids) => filasPorIds(ctx.workspaceId, ids),
  opcionesRelacion: async (ctx, clave) =>
    clave === "responsable" ? (await responsablesDe(ctx.workspaceId)).map((r) => ({ valor: String(r.id), etiqueta: r.nombre })) : [],
  validarRelacion: async (ctx, clave, id) => {
    if (clave !== "responsable" || !/^\d{1,10}$/.test(id)) return null;
    const r = (await responsablesDe(ctx.workspaceId)).find((x) => String(x.id) === id);
    return r?.nombre ?? null;
  },
  acciones: [ACCION_MARCAR_VENCIDOS],
  exportar: {
    columnas: [
      { titulo: "N°", tipo: "texto", valor: (f) => f.numero },
      { titulo: "Contacto", tipo: "texto", valor: (f) => f.contacto },
      { titulo: "Consulta", tipo: "texto", valor: (f) => f.consulta },
      { titulo: "Estado", tipo: "texto", valor: (f) => ETIQUETA_ESTADO[f.estado] },
      { titulo: "Total", tipo: "importe", valor: (f) => f.total },
      { titulo: "Vence", tipo: "texto", valor: (f) => fecha(f.validUntil) },
      { titulo: "Responsable", tipo: "texto", valor: (f) => f.responsable },
      { titulo: "Alta", tipo: "fechaHora", valor: (f) => f.createdAt },
    ],
  },
};
