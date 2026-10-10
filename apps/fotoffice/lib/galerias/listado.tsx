import "server-only";
import Link from "next/link";
import { prisma, type Prisma } from "@repo/db";
import { fechaBA } from "@/lib/ficha/formato";
import type { ConsultaResuelta, DefinicionListado, Opcion } from "@/lib/listado/tipos";
import { nombreDeContacto } from "@/lib/pedidos/nombre-contacto";
import { ESTADOS_GALERIA, ETIQUETA_ESTADO_GALERIA, esEstadoGaleria, type EstadoGaleria } from "./constantes";
import { claseDeEstadoGaleria } from "./estado-vista";

/**
 * Lista de Galerías sobre el motor de listas (0.2). Columnas: número, galería, proyecto, contacto,
 * estado, fotos y clientes (con los que esperan revisión resaltados). Filtros: estado y "esperando
 * revisión". Sin acciones en lote: todo se hace desde la ficha. Nunca lee nombres de archivo ni enlaces.
 */

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

export const OPCIONES_ESTADO_GALERIA: readonly Opcion[] = ESTADOS_GALERIA.map((e) => ({ valor: e, etiqueta: ETIQUETA_ESTADO_GALERIA[e] }));

export type FilaGaleria = {
  id: string;
  numero: string;
  nombre: string;
  proyectoId: string;
  proyectoNumero: string;
  proyectoNombre: string;
  contacto: string;
  estado: EstadoGaleria;
  fotos: number;
  clientes: number;
  enRevision: number;
  createdAt: Date;
};

const SELECT_GALERIA = {
  id: true,
  number: true,
  name: true,
  status: true,
  createdAt: true,
  proyecto: { select: { id: true, number: true, name: true, client: { select: { firstName: true, lastName: true, businessName: true } } } },
  _count: { select: { fotos: { where: { status: "LISTA" } }, clientes: true } },
} satisfies Prisma.FotofficeGaleriaSelect;

type FilaBase = Prisma.FotofficeGaleriaGetPayload<{ select: typeof SELECT_GALERIA }>;

function aFila(f: FilaBase, enRevision: number): FilaGaleria {
  return {
    id: f.id,
    numero: f.number,
    nombre: f.name,
    proyectoId: f.proyecto.id,
    proyectoNumero: f.proyecto.number,
    proyectoNombre: f.proyecto.name,
    contacto: nombreDeContacto(f.proyecto.client),
    estado: esEstadoGaleria(f.status) ? f.status : "BORRADOR",
    fotos: f._count.fotos,
    clientes: f._count.clientes,
    enRevision,
    createdAt: f.createdAt,
  };
}

const ESPERANDO: Prisma.FotofficeGaleriaClienteWhereInput = { status: "EN_REVISION", revokedAt: null };

/** Puro: lo que se le pide a Prisma. `workspaceId` va siempre. */
export function whereGalerias(workspaceId: string, c: ConsultaResuelta): Prisma.FotofficeGaleriaWhereInput {
  const and: Prisma.FotofficeGaleriaWhereInput[] = [];
  const q = c.q.trim();
  if (q) {
    const contiene = { contains: q, mode: "insensitive" as const };
    and.push({
      OR: [
        { number: contiene },
        { name: contiene },
        { proyecto: { is: { number: contiene } } },
        { proyecto: { is: { name: contiene } } },
        { proyecto: { is: { client: { is: { firstName: contiene } } } } },
        { proyecto: { is: { client: { is: { lastName: contiene } } } } },
        { proyecto: { is: { client: { is: { businessName: contiene } } } } },
      ],
    });
  }
  const estado = c.filtros.estado;
  if (estado && esEstadoGaleria(estado)) and.push({ status: estado });
  if (c.filtros.revision === "si") and.push({ clientes: { some: ESPERANDO } });
  else if (c.filtros.revision === "no") and.push({ NOT: { clientes: { some: ESPERANDO } } });
  return and.length > 0 ? { workspaceId, AND: and } : { workspaceId };
}

export function ordenarGalerias(c: ConsultaResuelta): Prisma.FotofficeGaleriaOrderByWithRelationInput[] {
  const dir = c.orden.desc ? "desc" : "asc";
  switch (c.orden.campo) {
    case "actualizado":
      return [{ updatedAt: dir }, { id: dir }];
    default:
      return [{ createdAt: dir }, { id: dir }];
  }
}

/** Cuántos clientes esperan revisión en cada galería (una sola consulta para toda la página). */
async function enRevisionPorGaleria(workspaceId: string, ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const filas = await prisma.fotofficeGaleriaCliente.groupBy({
    by: ["galeriaId"],
    where: { workspaceId, galeriaId: { in: ids }, ...ESPERANDO },
    _count: { _all: true },
  });
  return new Map(filas.map((f) => [f.galeriaId, f._count._all]));
}

async function filasConRevision(filas: FilaBase[], workspaceId: string): Promise<FilaGaleria[]> {
  const rev = await enRevisionPorGaleria(workspaceId, filas.map((f) => f.id));
  return filas.map((f) => aFila(f, rev.get(f.id) ?? 0));
}

async function filasPorIds(workspaceId: string, ids: string[]): Promise<FilaGaleria[]> {
  const validos = ids.filter((id) => ID_VALIDO.test(id));
  if (validos.length === 0) return [];
  const filas = await prisma.fotofficeGaleria.findMany({ where: { workspaceId, id: { in: validos } }, select: SELECT_GALERIA });
  const porId = new Map((await filasConRevision(filas, workspaceId)).map((f) => [f.id, f]));
  return validos.flatMap((id) => porId.get(id) ?? []);
}

const fecha = (d: Date) => fechaBA(d);

export const listadoGalerias: DefinicionListado<FilaGaleria> = {
  clave: "galerias",
  titulo: "Galerías",
  sustantivo: { singular: "galería", plural: "galerías" },
  placeholderBusqueda: "Buscar por número, galería, proyecto o contacto",
  columnas: [
    {
      clave: "numero",
      titulo: "N°",
      celda: (f) => (
        <Link href={`/galerias/${encodeURIComponent(f.id)}`} className="whitespace-nowrap font-medium tabular-nums text-[var(--fo-text)] hover:underline">
          {f.numero}
        </Link>
      ),
    },
    { clave: "nombre", titulo: "Galería", celda: (f) => <span className="text-[var(--fo-text)]">{f.nombre}</span> },
    {
      clave: "proyecto",
      titulo: "Proyecto",
      celda: (f) => (
        <Link href={`/proyectos/${encodeURIComponent(f.proyectoId)}`} className="text-[var(--fo-text)] hover:underline">
          N° {f.proyectoNumero} · {f.proyectoNombre}
        </Link>
      ),
      secundaria: true,
    },
    { clave: "contacto", titulo: "Cliente", celda: (f) => <span>{f.contacto}</span>, secundaria: true },
    {
      clave: "estado",
      titulo: "Estado",
      celda: (f) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${claseDeEstadoGaleria(f.estado)}`}>{ETIQUETA_ESTADO_GALERIA[f.estado]}</span>,
    },
    { clave: "fotos", titulo: "Fotos", alinear: "derecha", celda: (f) => <span className="tabular-nums">{f.fotos}</span> },
    {
      clave: "clientes",
      titulo: "Clientes",
      alinear: "derecha",
      celda: (f) => (
        <span className="inline-flex flex-wrap items-center justify-end gap-1">
          <span className="tabular-nums">{f.clientes}</span>
          {f.enRevision > 0 ? (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
              {f.enRevision === 1 ? "1 esperando revisión" : `${f.enRevision} esperando revisión`}
            </span>
          ) : null}
        </span>
      ),
    },
    { clave: "alta", titulo: "Creada", orden: "alta", celda: (f) => <span className="whitespace-nowrap">{fecha(f.createdAt)}</span>, secundaria: true },
  ],
  filtros: [
    { tipo: "opcion", clave: "estado", etiqueta: "Estado", opciones: OPCIONES_ESTADO_GALERIA },
    { tipo: "siNo", clave: "revision", etiqueta: "Revisión", si: "Esperando revisión", no: "Sin selecciones por revisar" },
  ],
  ordenes: ["alta", "actualizado"],
  ordenPorDefecto: { campo: "alta", desc: true },
  idDe: (f) => f.id,
  hrefFicha: (id) => `/galerias/${encodeURIComponent(id)}`,
  contar: async (ctx, c) => prisma.fotofficeGaleria.count({ where: whereGalerias(ctx.workspaceId, c) }),
  traer: async (ctx, c, { skip, take }) => {
    const filas = await prisma.fotofficeGaleria.findMany({ where: whereGalerias(ctx.workspaceId, c), select: SELECT_GALERIA, orderBy: ordenarGalerias(c), skip, take });
    return filasConRevision(filas, ctx.workspaceId);
  },
  traerIds: async (ctx, c, tope) => {
    const filas = await prisma.fotofficeGaleria.findMany({ where: whereGalerias(ctx.workspaceId, c), select: { id: true }, orderBy: ordenarGalerias(c), take: tope });
    return filas.map((f) => f.id);
  },
  traerPorIds: async (ctx, ids) => filasPorIds(ctx.workspaceId, ids),
  acciones: [],
  exportar: {
    columnas: [
      { titulo: "N°", tipo: "texto", valor: (f) => f.numero },
      { titulo: "Galería", tipo: "texto", valor: (f) => f.nombre },
      { titulo: "Proyecto", tipo: "texto", valor: (f) => `${f.proyectoNumero} · ${f.proyectoNombre}` },
      { titulo: "Cliente", tipo: "texto", valor: (f) => f.contacto },
      { titulo: "Estado", tipo: "texto", valor: (f) => ETIQUETA_ESTADO_GALERIA[f.estado] },
      { titulo: "Fotos", tipo: "numero", valor: (f) => f.fotos },
      { titulo: "Clientes", tipo: "numero", valor: (f) => f.clientes },
      { titulo: "Esperando revisión", tipo: "numero", valor: (f) => f.enRevision },
      { titulo: "Creada", tipo: "fechaHora", valor: (f) => f.createdAt },
    ],
  },
};
