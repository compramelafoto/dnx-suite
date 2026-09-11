/**
 * Repositorio de propuestas comerciales guardadas.
 *
 * El dominio —código, vencimiento, estados— vive en `@repo/partners`, sin base
 * de datos. Acá está lo que sí la necesita: guardar la propuesta con un código
 * único, recuperarla, y borrar las vencidas.
 *
 * La regla que gobierna el código: **la unicidad la dice el índice, no el
 * generador**. Dos propuestas con el mismo código harían que un vendedor
 * abriera la de otro, y con mil millones de combinaciones la colisión es
 * improbable pero no imposible. Por eso se reintenta ante el rechazo de la base
 * en vez de consultar antes si el código está libre.
 */
import { randomInt } from "node:crypto";
import {
  generateProposalCode,
  isProposalExpired,
  normalizeProposalCode,
  proposalExpiryFrom,
  type DnxPartnerProposalStatus,
} from "@repo/partners";
import { prisma } from "./client.js";

/** Postgres devuelve esto cuando un índice único rechaza la fila. */
const UNIQUE_VIOLATION = "P2002";

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  return (err as { code?: unknown }).code === UNIQUE_VIOLATION;
}

export type ProposalItemInput = {
  kind?: "DIGITAL_PLACEMENT" | "PHYSICAL" | "MERCHANDISING" | "MENTION";
  pieceId?: string | null;
  placementKey?: string | null;
  label: string;
  location?: string | null;
  quantity?: number;
  unitPriceMinor?: number | null;
  currency?: string | null;
  selection?: "INCLUDED" | "OPTIONAL" | "EXCLUDED";
  sortOrder?: number;
};

export type CreateProposalInput = {
  brandName: string;
  industry?: string | null;
  contactUrl?: string | null;
  period: { startsAt: Date; endsAt: Date };
  logoStorageKey?: string | null;
  logoMeta?: Record<string, unknown> | null;
  createdByUserId?: number | null;
  clientKeyHash?: string | null;
  now: Date;
  /** Días de vigencia. Por defecto los treinta del dominio. */
  ttlDays?: number;
  items: readonly ProposalItemInput[];
};

export type ProposalItemRow = {
  id: string;
  kind: string;
  pieceId: string | null;
  placementKey: string | null;
  label: string;
  location: string | null;
  quantity: number;
  unitPriceMinor: number | null;
  currency: string | null;
  selection: string;
  sortOrder: number;
};

export type ProposalRow = {
  id: string;
  code: string;
  status: DnxPartnerProposalStatus;
  brandName: string;
  industry: string | null;
  contactUrl: string | null;
  periodStart: Date;
  periodEnd: Date;
  logoStorageKey: string | null;
  logoMeta: unknown;
  createdByUserId: number | null;
  expiresAt: Date;
  convertedPartnerId: string | null;
  convertedAt: Date | null;
  createdAt: Date;
  items: ProposalItemRow[];
};

const CAMPOS = {
  id: true,
  code: true,
  status: true,
  brandName: true,
  industry: true,
  contactUrl: true,
  periodStart: true,
  periodEnd: true,
  logoStorageKey: true,
  logoMeta: true,
  createdByUserId: true,
  expiresAt: true,
  convertedPartnerId: true,
  convertedAt: true,
  createdAt: true,
  items: {
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      kind: true,
      pieceId: true,
      placementKey: true,
      label: true,
      location: true,
      quantity: true,
      unitPriceMinor: true,
      currency: true,
      selection: true,
      sortOrder: true,
    },
  },
} as const;

/**
 * Guarda la propuesta con un código nuevo.
 *
 * Reintenta mientras la base rechace el código por repetido. Cinco intentos son
 * de sobra: con mil millones de combinaciones, que dos seguidos choquen ya es
 * señal de que algo más está mal —un generador roto, por ejemplo— y conviene
 * que falle antes que girar en falso.
 */
export async function createProposal(input: CreateProposalInput): Promise<ProposalRow> {
  const expiresAt = proposalExpiryFrom(input.now, input.ttlDays);
  const lineas = input.items.map((item, indice) => ({
    kind: item.kind ?? "DIGITAL_PLACEMENT",
    pieceId: item.pieceId ?? null,
    placementKey: item.placementKey ?? null,
    label: item.label,
    location: item.location ?? null,
    quantity: item.quantity ?? 1,
    unitPriceMinor: item.unitPriceMinor ?? null,
    currency: item.currency ?? null,
    selection: item.selection ?? "INCLUDED",
    sortOrder: item.sortOrder ?? indice,
  }));

  let ultimoError: unknown = null;
  for (let intento = 0; intento < 5; intento += 1) {
    try {
      const fila = await prisma.dnxPartnerProposal.create({
        data: {
          code: generateProposalCode((max) => randomInt(max)),
          status: "READY",
          brandName: input.brandName,
          industry: input.industry ?? null,
          contactUrl: input.contactUrl ?? null,
          periodStart: input.period.startsAt,
          periodEnd: input.period.endsAt,
          logoStorageKey: input.logoStorageKey ?? null,
          logoMeta: (input.logoMeta ?? undefined) as never,
          createdByUserId: input.createdByUserId ?? null,
          clientKeyHash: input.clientKeyHash ?? null,
          expiresAt,
          items: { create: lineas },
        },
        select: CAMPOS,
      });
      return fila as ProposalRow;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      ultimoError = err;
    }
  }
  throw ultimoError ?? new Error("PROPOSAL_CODE_COLLISION");
}

/**
 * Recupera una propuesta por su código.
 *
 * Devuelve `null` para lo que no se puede abrir: código mal escrito, propuesta
 * inexistente o vencida. Los tres casos se responden igual a propósito —quien
 * prueba códigos al azar no debería poder distinguir «no existe» de «venció»—.
 */
export async function getProposalByCode(input: {
  code: string;
  now: Date;
}): Promise<ProposalRow | null> {
  const code = normalizeProposalCode(input.code);
  if (!code) return null;

  const fila = (await prisma.dnxPartnerProposal.findUnique({
    where: { code },
    select: CAMPOS,
  })) as ProposalRow | null;

  if (!fila) return null;
  if (isProposalExpired(fila, input.now)) return null;
  return fila;
}

/**
 * Marca como vencidas las que pasaron su fecha.
 *
 * El dominio ya las trata como vencidas al recuperarlas, así que esto no cambia
 * lo que ve nadie. Lo que hace es dejar el estado consistente para el listado y
 * separar el marcado del borrado: entre uno y otro hay días de gracia por si
 * alguien pide recuperar algo recién vencido.
 */
export async function expireProposals(now: Date): Promise<number> {
  const resultado = await prisma.dnxPartnerProposal.updateMany({
    where: { status: { in: ["DRAFT", "READY"] }, expiresAt: { lte: now } },
    data: { status: "EXPIRED" },
  });
  return resultado.count;
}

export type PurgedProposal = { id: string; code: string; logoStorageKey: string | null };

/**
 * Borra las vencidas y devuelve los logos que quedaron huérfanos.
 *
 * No borra el archivo: quien llama sabe dónde vive el almacenamiento. Devolver
 * las claves en vez de borrarlas acá es lo que permite probar esta función sin
 * tocar R2.
 *
 * Las convertidas se conservan como historial. Su logo se libera aparte, con
 * `releaseConvertedProposalLogos`: el archivo ya vive como asset del sponsor.
 */
export async function purgeExpiredProposals(input: {
  now: Date;
  /** Días de gracia después del vencimiento. */
  graceDays?: number;
  limit?: number;
}): Promise<PurgedProposal[]> {
  const gracia = input.graceDays ?? 7;
  const corte = new Date(input.now.getTime() - gracia * 24 * 60 * 60 * 1000);

  const candidatas = (await prisma.dnxPartnerProposal.findMany({
    where: { status: { not: "CONVERTED" }, expiresAt: { lte: corte } },
    select: { id: true, code: true, logoStorageKey: true },
    take: input.limit ?? 200,
  })) as PurgedProposal[];

  if (candidatas.length === 0) return [];

  // En cascada: las líneas se van con la propuesta.
  await prisma.dnxPartnerProposal.deleteMany({
    where: { id: { in: candidatas.map((c) => c.id) } },
  });
  return candidatas;
}

/**
 * Suelta el logo de las convertidas: la fila queda como historial, el archivo no.
 *
 * Devuelve las claves para que quien llama las borre del almacenamiento.
 */
export async function releaseConvertedProposalLogos(input: {
  now: Date;
  graceDays?: number;
  limit?: number;
}): Promise<string[]> {
  const gracia = input.graceDays ?? 30;
  const corte = new Date(input.now.getTime() - gracia * 24 * 60 * 60 * 1000);

  const filas = await prisma.dnxPartnerProposal.findMany({
    where: {
      status: "CONVERTED",
      logoStorageKey: { not: null },
      convertedAt: { lte: corte },
    },
    select: { id: true, logoStorageKey: true },
    take: input.limit ?? 200,
  });
  if (filas.length === 0) return [];

  await prisma.dnxPartnerProposal.updateMany({
    where: { id: { in: filas.map((f) => f.id) } },
    data: { logoStorageKey: null },
  });
  return filas.map((f) => f.logoStorageKey).filter((k): k is string => Boolean(k));
}

export type ProposalListRow = Omit<ProposalRow, "items"> & { itemCount: number };

/** El listado del panel. Ordenado por lo último armado. */
export async function listProposals(input?: {
  status?: DnxPartnerProposalStatus;
  limit?: number;
}): Promise<ProposalListRow[]> {
  const filas = await prisma.dnxPartnerProposal.findMany({
    where: input?.status ? { status: input.status } : undefined,
    orderBy: { createdAt: "desc" },
    take: input?.limit ?? 100,
    select: { ...CAMPOS, items: false, _count: { select: { items: true } } },
  });
  return filas.map((fila) => {
    const { _count, ...resto } = fila as typeof fila & { _count: { items: number } };
    return { ...(resto as Omit<ProposalRow, "items">), itemCount: _count.items };
  });
}
