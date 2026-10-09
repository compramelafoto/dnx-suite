import "server-only";
import Link from "next/link";
import { prisma, type Prisma } from "@repo/db";
import { TOPE_IDS_POR_CONSULTA } from "@/lib/listado/presupuesto";
import { hoyEnBuenosAires } from "@/lib/listado/periodos";
import type { ConsultaResuelta, DefinicionListado, Opcion } from "@/lib/listado/tipos";
import { nombreDeContacto } from "@/lib/pedidos/nombre-contacto";
import { atraso, fechaValida } from "./fechas";

/**
 * Lista de Proyectos sobre el motor de listas (0.2). Columnas: número, nombre, contacto,
 * responsable, etapa, fecha final, atraso y estado. Filtros: estado y vencidos. Ordenes: alta,
 * fecha final y actualizado.
 *
 * "Cerrado" sale del recorrido (no hay columna en el proyecto), así que se resuelve con los ids
 * de los proyectos con recorrido cerrado; si son más que el tope, la lista sale vacía con aviso.
 * Un proyecto suspendido nunca cuenta como vencido.
 */

export const ESTADOS_PROYECTO = ["EN_CURSO", "SUSPENDIDO", "CERRADO"] as const;
export type EstadoProyecto = (typeof ESTADOS_PROYECTO)[number];
export const ETIQUETA_ESTADO_PROYECTO: Record<EstadoProyecto, string> = { EN_CURSO: "En curso", SUSPENDIDO: "Suspendido", CERRADO: "Cerrado" };
export const OPCIONES_ESTADO_PROYECTO: readonly Opcion[] = ESTADOS_PROYECTO.map((e) => ({ valor: e, etiqueta: ETIQUETA_ESTADO_PROYECTO[e] }));
export const AVISO_DEMASIADOS_PROYECTOS = "Hay demasiados proyectos cerrados para filtrar por estado. Buscá por número o nombre.";

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
const COLOR_ESTADO: Record<EstadoProyecto, string> = {
  EN_CURSO: "bg-blue-100 text-blue-800",
  SUSPENDIDO: "bg-amber-100 text-amber-800",
  CERRADO: "bg-gray-100 text-gray-700",
};

export type FilaProyecto = {
  id: string;
  numero: string;
  nombre: string;
  clientId: string;
  contacto: string;
  responsable: string | null;
  etapa: string | null;
  finalDueDate: string | null;
  atraso: number;
  estado: EstadoProyecto;
  suspendReason: string | null;
  createdAt: Date;
};

const SELECT_PROYECTO = {
  id: true, number: true, name: true, clientId: true, ownerUserId: true, finalDueDate: true,
  suspendedAt: true, suspendReason: true, createdAt: true,
} as const;

type Cerrados = { excedido: true } | { excedido: false; ids: string[] };

async function idsCerrados(workspaceId: string): Promise<Cerrados> {
  const filas = await prisma.fotofficeJourney.findMany({
    where: { workspaceId, subjectType: "PROYECTO", closedAt: { not: null } },
    select: { subjectId: true },
    take: TOPE_IDS_POR_CONSULTA + 1,
  });
  if (filas.length > TOPE_IDS_POR_CONSULTA) return { excedido: true };
  return { excedido: false, ids: [...new Set(filas.map((f) => f.subjectId as string))] };
}

const usaCerrados = (c: ConsultaResuelta) => c.filtros.estado === "CERRADO" || c.filtros.estado === "EN_CURSO" || c.filtros.vencidos === "si" || c.filtros.vencidos === "no";

/** Puro: lo que se le pide a Prisma. `workspaceId` va siempre. `hoy` = "aaaa-mm-dd". */
export function whereProyectos(workspaceId: string, c: ConsultaResuelta, cerrados: Cerrados | null, hoy: string): Prisma.FotofficeProyectoWhereInput {
  if (cerrados?.excedido) return { workspaceId, id: { in: [] } };
  const ids = cerrados && !cerrados.excedido ? cerrados.ids : [];
  const and: Prisma.FotofficeProyectoWhereInput[] = [];
  const q = c.q.trim();
  if (q) {
    const contiene = { contains: q, mode: "insensitive" as const };
    and.push({
      OR: [
        { number: contiene },
        { name: contiene },
        { client: { is: { firstName: contiene } } },
        { client: { is: { lastName: contiene } } },
        { client: { is: { businessName: contiene } } },
      ],
    });
  }
  switch (c.filtros.estado) {
    case "SUSPENDIDO": and.push({ suspendedAt: { not: null } }); break;
    case "CERRADO": and.push({ id: { in: ids } }); break;
    case "EN_CURSO": and.push({ suspendedAt: null }, { NOT: { id: { in: ids } } }); break;
  }
  // Vencido = pasó su fecha final y sigue vivo (ni suspendido ni cerrado).
  const vencido: Prisma.FotofficeProyectoWhereInput = {
    finalDueDate: { lt: new Date(`${hoy}T00:00:00.000Z`) },
    suspendedAt: null,
    NOT: { id: { in: ids } },
  };
  if (c.filtros.vencidos === "si") and.push(vencido);
  else if (c.filtros.vencidos === "no") and.push({ NOT: vencido });
  return and.length > 0 ? { workspaceId, AND: and } : { workspaceId };
}

async function resolverWhere(workspaceId: string, c: ConsultaResuelta) {
  const cerrados = usaCerrados(c) ? await idsCerrados(workspaceId) : null;
  return whereProyectos(workspaceId, c, cerrados, hoyEnBuenosAires());
}

function ordenarPor(c: ConsultaResuelta): Prisma.FotofficeProyectoOrderByWithRelationInput[] {
  const dir = c.orden.desc ? "desc" : "asc";
  switch (c.orden.campo) {
    case "vence": return [{ finalDueDate: { sort: dir, nulls: "last" } }, { id: dir }];
    case "actualizado": return [{ updatedAt: dir }, { id: dir }];
    default: return [{ createdAt: dir }, { id: dir }];
  }
}

type FilaBase = Prisma.FotofficeProyectoGetPayload<{ select: typeof SELECT_PROYECTO }>;

/** Contacto, responsable, etapa, atraso y estado de un lote de proyectos, en pocas lecturas. */
async function completar(workspaceId: string, filas: FilaBase[]): Promise<FilaProyecto[]> {
  if (filas.length === 0) return [];
  const ids = filas.map((f) => f.id);
  const [clientes, usuarios, recorridos] = await Promise.all([
    prisma.client.findMany({
      where: { workspaceId, id: { in: [...new Set(filas.map((f) => f.clientId))] } },
      select: { id: true, firstName: true, lastName: true, businessName: true },
    }),
    prisma.user.findMany({
      where: { id: { in: [...new Set(filas.map((f) => f.ownerUserId).filter((x): x is number => x !== null))] } },
      select: { id: true, name: true, email: true },
    }),
    prisma.fotofficeJourney.findMany({
      where: { workspaceId, subjectType: "PROYECTO", subjectId: { in: ids } },
      select: { subjectId: true, stageId: true, closedAt: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);
  // Un recorrido abierto manda; si no hay, el último cerrado.
  const recorridoDe = new Map<string, (typeof recorridos)[number]>();
  for (const r of recorridos) {
    const actual = recorridoDe.get(r.subjectId as string);
    if (!actual || (actual.closedAt !== null && r.closedAt === null)) recorridoDe.set(r.subjectId as string, r);
  }
  const etapaIds = [...new Set([...recorridoDe.values()].map((r) => r.stageId as string | null).filter((x): x is string => x !== null))];
  const [etapas, planes] = etapaIds.length
    ? await Promise.all([
        prisma.fotofficeStage.findMany({ where: { id: { in: etapaIds }, circuit: { workspaceId } }, select: { id: true, name: true } }),
        prisma.fotofficeProyectoEtapaPlan.findMany({ where: { workspaceId, proyectoId: { in: ids }, stageId: { in: etapaIds } }, select: { proyectoId: true, stageId: true, plannedDueDate: true } }),
      ])
    : [[], []];
  const cliente = new Map(clientes.map((c) => [c.id as string, c]));
  const usuario = new Map(usuarios.map((u) => [u.id as number, (u.name as string | null) || (u.email as string)]));
  const etapa = new Map(etapas.map((e) => [e.id as string, e.name as string]));
  const plan = new Map(planes.map((p) => [`${p.proyectoId}:${p.stageId}`, p.plannedDueDate as Date]));
  const hoy = hoyEnBuenosAires();

  return filas.map((f) => {
    const r = recorridoDe.get(f.id);
    const cerrado = r ? r.closedAt !== null : false;
    const estado: EstadoProyecto = f.suspendedAt !== null ? "SUSPENDIDO" : cerrado ? "CERRADO" : "EN_CURSO";
    const stageId = r?.stageId as string | null | undefined;
    const planDeEtapa = stageId ? (plan.get(`${f.id}:${stageId}`) ?? null) : null;
    return {
      id: f.id,
      numero: f.number,
      nombre: f.name,
      clientId: f.clientId,
      contacto: nombreDeContacto(cliente.get(f.clientId) as Parameters<typeof nombreDeContacto>[0]),
      responsable: f.ownerUserId !== null ? (usuario.get(f.ownerUserId) ?? null) : null,
      etapa: stageId ? (etapa.get(stageId) ?? null) : null,
      finalDueDate: fechaValida(f.finalDueDate),
      // Sólo atrasa lo que sigue vivo: ni suspendido ni cerrado.
      atraso: estado === "EN_CURSO" ? atraso(planDeEtapa, hoy) : 0,
      estado,
      suspendReason: f.suspendReason,
      createdAt: f.createdAt,
    };
  });
}

async function filasPorIds(workspaceId: string, ids: string[]): Promise<FilaProyecto[]> {
  const validos = ids.filter((id) => ID_VALIDO.test(id));
  if (validos.length === 0) return [];
  const filas = await prisma.fotofficeProyecto.findMany({ where: { workspaceId, id: { in: validos } }, select: SELECT_PROYECTO });
  const porId = new Map((await completar(workspaceId, filas)).map((f) => [f.id, f]));
  return validos.flatMap((id) => porId.get(id) ?? []);
}

const fecha = (ymd: string | null) => (ymd ? ymd.split("-").reverse().join("/") : "—");

export const listadoProyectos: DefinicionListado<FilaProyecto> = {
  clave: "proyectos",
  titulo: "Proyectos",
  sustantivo: { singular: "proyecto", plural: "proyectos" },
  placeholderBusqueda: "Buscar por número, nombre o contacto",
  columnas: [
    {
      clave: "numero",
      titulo: "N°",
      celda: (f) => (
        <Link href={`/proyectos/${encodeURIComponent(f.id)}`} className="whitespace-nowrap font-medium tabular-nums text-[var(--fo-text)] hover:underline">
          {f.numero}
        </Link>
      ),
    },
    { clave: "nombre", titulo: "Proyecto", celda: (f) => <span>{f.nombre}</span> },
    {
      clave: "contacto",
      titulo: "Contacto",
      celda: (f) => (
        <Link href={`/clientes/${encodeURIComponent(f.clientId)}`} className="text-[var(--fo-text)] hover:underline">
          {f.contacto}
        </Link>
      ),
      secundaria: true,
    },
    { clave: "responsable", titulo: "Responsable", celda: (f) => f.responsable ?? "—", secundaria: true },
    { clave: "etapa", titulo: "Etapa", celda: (f) => f.etapa ?? "—" },
    { clave: "vence", titulo: "Fecha final", orden: "vence", celda: (f) => fecha(f.finalDueDate) },
    {
      clave: "atraso",
      titulo: "Atraso",
      alinear: "derecha",
      celda: (f) => (f.atraso > 0 ? <span className="font-medium text-[var(--fo-danger)]">{f.atraso} {f.atraso === 1 ? "día" : "días"}</span> : "—"),
    },
    {
      clave: "estado",
      titulo: "Estado",
      celda: (f) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLOR_ESTADO[f.estado]}`}>{ETIQUETA_ESTADO_PROYECTO[f.estado]}</span>,
    },
  ],
  filtros: [
    { tipo: "opcion", clave: "estado", etiqueta: "Estado", opciones: OPCIONES_ESTADO_PROYECTO },
    { tipo: "siNo", clave: "vencidos", etiqueta: "Fecha final", si: "Vencidos", no: "No vencidos" },
  ],
  ordenes: ["alta", "vence", "actualizado"],
  ordenPorDefecto: { campo: "alta", desc: true },
  idDe: (f) => f.id,
  hrefFicha: (id) => `/proyectos/${encodeURIComponent(id)}`,
  contar: async (ctx, c) => prisma.fotofficeProyecto.count({ where: await resolverWhere(ctx.workspaceId, c) }),
  traer: async (ctx, c, { skip, take }) => {
    const filas = await prisma.fotofficeProyecto.findMany({ where: await resolverWhere(ctx.workspaceId, c), select: SELECT_PROYECTO, orderBy: ordenarPor(c), skip, take });
    return completar(ctx.workspaceId, filas);
  },
  traerIds: async (ctx, c, tope) => {
    const filas = await prisma.fotofficeProyecto.findMany({ where: await resolverWhere(ctx.workspaceId, c), select: { id: true }, orderBy: ordenarPor(c), take: tope });
    return filas.map((f) => f.id);
  },
  traerPorIds: async (ctx, ids) => filasPorIds(ctx.workspaceId, ids),
  aviso: async (ctx, c) => (usaCerrados(c) && (await idsCerrados(ctx.workspaceId)).excedido ? AVISO_DEMASIADOS_PROYECTOS : null),
  acciones: [],
  exportar: {
    columnas: [
      { titulo: "N°", tipo: "texto", valor: (f) => f.numero },
      { titulo: "Proyecto", tipo: "texto", valor: (f) => f.nombre },
      { titulo: "Contacto", tipo: "texto", valor: (f) => f.contacto },
      { titulo: "Responsable", tipo: "texto", valor: (f) => f.responsable },
      { titulo: "Etapa", tipo: "texto", valor: (f) => f.etapa },
      { titulo: "Fecha final", tipo: "texto", valor: (f) => fecha(f.finalDueDate) },
      { titulo: "Atraso (días)", tipo: "numero", valor: (f) => f.atraso },
      { titulo: "Estado", tipo: "texto", valor: (f) => ETIQUETA_ESTADO_PROYECTO[f.estado] },
      { titulo: "Alta", tipo: "fechaHora", valor: (f) => f.createdAt },
    ],
  },
};
