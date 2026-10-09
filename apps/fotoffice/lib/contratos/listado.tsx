import "server-only";
import Link from "next/link";
import { prisma, type Prisma } from "@repo/db";
import { fechaBA } from "@/lib/ficha/formato";
import type { ConsultaResuelta, DefinicionListado, Opcion } from "@/lib/listado/tipos";
import { nombreDeContacto } from "@/lib/pedidos/nombre-contacto";
import { claseDeEstadoContrato } from "./estado-vista";
import { ESTADOS_CONTRATO, ETIQUETA_ESTADO_CONTRATO, esEstadoContrato, type EstadoContrato } from "./constantes";

/**
 * Lista de Contratos sobre el motor de listas (0.2). Columnas: número, contacto, pedido, estado,
 * enviado y firmado. Filtro por estado. Sin plata y sin acciones en lote: todo se hace desde la ficha.
 * Nunca lee el texto del contrato.
 */

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

export const OPCIONES_ESTADO_CONTRATO: readonly Opcion[] = ESTADOS_CONTRATO.map((e) => ({ valor: e, etiqueta: ETIQUETA_ESTADO_CONTRATO[e] }));

export type FilaContrato = {
  id: string;
  numero: string;
  nombre: string;
  clientId: string;
  contacto: string;
  pedidoId: string;
  pedidoNumero: string;
  estado: EstadoContrato;
  enviadoEn: Date | null;
  firmadoEn: Date | null;
  createdAt: Date;
};

const SELECT_CONTRATO = {
  id: true,
  number: true,
  name: true,
  clientId: true,
  pedidoId: true,
  status: true,
  sentAt: true,
  signedAt: true,
  createdAt: true,
  client: { select: { firstName: true, lastName: true, businessName: true } },
  pedido: { select: { number: true } },
} satisfies Prisma.FotofficeContratoSelect;

type FilaBase = Prisma.FotofficeContratoGetPayload<{ select: typeof SELECT_CONTRATO }>;

function aFila(f: FilaBase): FilaContrato {
  return {
    id: f.id,
    numero: f.number,
    nombre: f.name,
    clientId: f.clientId,
    contacto: nombreDeContacto(f.client),
    pedidoId: f.pedidoId,
    pedidoNumero: f.pedido.number,
    estado: esEstadoContrato(f.status) ? f.status : "BORRADOR",
    enviadoEn: f.sentAt,
    firmadoEn: f.signedAt,
    createdAt: f.createdAt,
  };
}

/** Puro: lo que se le pide a Prisma. `workspaceId` va siempre. */
export function whereContratos(workspaceId: string, c: ConsultaResuelta): Prisma.FotofficeContratoWhereInput {
  const and: Prisma.FotofficeContratoWhereInput[] = [];
  const q = c.q.trim();
  if (q) {
    const contiene = { contains: q, mode: "insensitive" as const };
    and.push({
      OR: [
        { number: contiene },
        { name: contiene },
        { pedido: { is: { number: contiene } } },
        { client: { is: { firstName: contiene } } },
        { client: { is: { lastName: contiene } } },
        { client: { is: { businessName: contiene } } },
      ],
    });
  }
  const estado = c.filtros.estado;
  if (estado && esEstadoContrato(estado)) and.push({ status: estado });
  return and.length > 0 ? { workspaceId, AND: and } : { workspaceId };
}

export function ordenarContratos(c: ConsultaResuelta): Prisma.FotofficeContratoOrderByWithRelationInput[] {
  const dir = c.orden.desc ? "desc" : "asc";
  switch (c.orden.campo) {
    case "enviado":
      return [{ sentAt: { sort: dir, nulls: "last" } }, { id: dir }];
    case "firmado":
      return [{ signedAt: { sort: dir, nulls: "last" } }, { id: dir }];
    default:
      return [{ createdAt: dir }, { id: dir }];
  }
}

async function filasPorIds(workspaceId: string, ids: string[]): Promise<FilaContrato[]> {
  const validos = ids.filter((id) => ID_VALIDO.test(id));
  if (validos.length === 0) return [];
  const filas = await prisma.fotofficeContrato.findMany({ where: { workspaceId, id: { in: validos } }, select: SELECT_CONTRATO });
  const porId = new Map(filas.map((f) => [f.id, aFila(f)]));
  return validos.flatMap((id) => porId.get(id) ?? []);
}

const fecha = (d: Date | null) => (d ? fechaBA(d) : "—");

export const listadoContratos: DefinicionListado<FilaContrato> = {
  clave: "contratos",
  titulo: "Contratos",
  sustantivo: { singular: "contrato", plural: "contratos" },
  placeholderBusqueda: "Buscar por número, contacto o pedido",
  columnas: [
    {
      clave: "numero",
      titulo: "N°",
      celda: (f) => (
        <Link href={`/contratos/${encodeURIComponent(f.id)}`} className="whitespace-nowrap font-medium tabular-nums text-[var(--fo-text)] hover:underline">
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
      clave: "pedido",
      titulo: "Pedido",
      celda: (f) => (
        <Link href={`/pedidos/${encodeURIComponent(f.pedidoId)}`} className="whitespace-nowrap tabular-nums text-[var(--fo-text)] hover:underline">
          N° {f.pedidoNumero}
        </Link>
      ),
      secundaria: true,
    },
    {
      clave: "estado",
      titulo: "Estado",
      celda: (f) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${claseDeEstadoContrato(f.estado)}`}>{ETIQUETA_ESTADO_CONTRATO[f.estado]}</span>,
    },
    { clave: "enviado", titulo: "Enviado", orden: "enviado", celda: (f) => <span className="whitespace-nowrap">{fecha(f.enviadoEn)}</span>, secundaria: true },
    { clave: "firmado", titulo: "Firmado", orden: "firmado", celda: (f) => <span className="whitespace-nowrap">{fecha(f.firmadoEn)}</span> },
  ],
  filtros: [{ tipo: "opcion", clave: "estado", etiqueta: "Estado", opciones: OPCIONES_ESTADO_CONTRATO }],
  ordenes: ["alta", "enviado", "firmado"],
  ordenPorDefecto: { campo: "alta", desc: true },
  idDe: (f) => f.id,
  hrefFicha: (id) => `/contratos/${encodeURIComponent(id)}`,
  contar: async (ctx, c) => prisma.fotofficeContrato.count({ where: whereContratos(ctx.workspaceId, c) }),
  traer: async (ctx, c, { skip, take }) => {
    const filas = await prisma.fotofficeContrato.findMany({ where: whereContratos(ctx.workspaceId, c), select: SELECT_CONTRATO, orderBy: ordenarContratos(c), skip, take });
    return filas.map(aFila);
  },
  traerIds: async (ctx, c, tope) => {
    const filas = await prisma.fotofficeContrato.findMany({ where: whereContratos(ctx.workspaceId, c), select: { id: true }, orderBy: ordenarContratos(c), take: tope });
    return filas.map((f) => f.id);
  },
  traerPorIds: async (ctx, ids) => filasPorIds(ctx.workspaceId, ids),
  acciones: [],
  exportar: {
    columnas: [
      { titulo: "N°", tipo: "texto", valor: (f) => f.numero },
      { titulo: "Contrato", tipo: "texto", valor: (f) => f.nombre },
      { titulo: "Contacto", tipo: "texto", valor: (f) => f.contacto },
      { titulo: "Pedido", tipo: "texto", valor: (f) => f.pedidoNumero },
      { titulo: "Estado", tipo: "texto", valor: (f) => ETIQUETA_ESTADO_CONTRATO[f.estado] },
      { titulo: "Enviado", tipo: "fechaHora", valor: (f) => f.enviadoEn },
      { titulo: "Firmado", tipo: "fechaHora", valor: (f) => f.firmadoEn },
      { titulo: "Alta", tipo: "fechaHora", valor: (f) => f.createdAt },
    ],
  },
};
