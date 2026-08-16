/**
 * Acceso a datos del dominio Member/MemberCategory (módulo institucional
 * `members` de FotoOffice).
 *
 * Toda función acá exige `workspaceId` como primer parámetro. Las lecturas
 * puntuales (`getMember`, `getMemberCategory`) usan `findFirst({ id, workspaceId })`
 * en vez de `findUnique({ id })` a propósito: aunque alguien tenga un id de
 * otro workspace (por bug o por manipular una URL), sin el `workspaceId`
 * correcto no hay fila. Las escrituras puntuales (`updateMember`,
 * `updateMemberCategory`) usan `updateMany({ where: { id, workspaceId } })`
 * por el mismo motivo: es atómico y nunca puede tocar una fila de otro
 * workspace, a diferencia de `update({ where: { id } })`.
 * No es un framework — son funciones mínimas para no repetir el
 * `where: { workspaceId }` suelto por toda la aplicación.
 */
import { prisma } from "./client";
import type { Member, MemberCategory, MemberStatus, Prisma } from "@prisma/client";

export type CreateMemberInput = {
  memberNumber: string;
  categoryId?: string | null;
  firstName: string;
  lastName: string;
  documentType?: string | null;
  documentNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  birthDate?: Date | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  joinedAt?: Date;
  status?: MemberStatus;
  notes?: string | null;
  /** Vínculo opcional a una cuenta DNX ya existente. */
  userId?: number | null;
};

export type UpdateMemberInput = Partial<CreateMemberInput> & {
  leftAt?: Date | null;
};

export type MemberWithCategory = Member & { category: MemberCategory | null };

export type MemberSearchFilters = {
  search?: string;
  categoryId?: string;
  status?: MemberStatus;
  page?: number;
  pageSize?: number;
};

export type MemberSearchResult = {
  items: MemberWithCategory[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function searchMembers(
  workspaceId: string,
  filters: MemberSearchFilters = {},
): Promise<MemberSearchResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const search = filters.search?.trim();

  const where: Prisma.MemberWhereInput = {
    workspaceId,
    status: filters.status,
    categoryId: filters.categoryId,
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { memberNumber: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { documentNumber: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.member.findMany({
      where,
      include: { category: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.member.count({ where }),
  ]);

  return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export type MemberStatusCounts = { total: number; ACTIVE: number; SUSPENDED: number; INACTIVE: number };

export async function countMembersByStatus(workspaceId: string): Promise<MemberStatusCounts> {
  const rows = await prisma.member.groupBy({
    by: ["status"],
    where: { workspaceId },
    _count: { _all: true },
  });
  const counts: MemberStatusCounts = { total: 0, ACTIVE: 0, SUSPENDED: 0, INACTIVE: 0 };
  for (const row of rows) {
    counts[row.status] = row._count._all;
    counts.total += row._count._all;
  }
  return counts;
}

/** `findFirst`, no `findUnique`: un memberId de otro workspace nunca matchea. */
export function getMember(workspaceId: string, memberId: string): Promise<MemberWithCategory | null> {
  return prisma.member.findFirst({ where: { id: memberId, workspaceId }, include: { category: true } });
}

export function createMember(workspaceId: string, input: CreateMemberInput): Promise<Member> {
  return prisma.member.create({ data: { workspaceId, ...input } });
}

/**
 * `updateMany` con `{ id, workspaceId }`: si `memberId` pertenece a otro
 * workspace, matchea 0 filas y no toca nada — nunca `update({ where: { id } })`.
 * Devuelve `null` si no matcheó (no encontrado O de otro workspace, misma respuesta).
 */
export async function updateMember(
  workspaceId: string,
  memberId: string,
  data: UpdateMemberInput,
): Promise<MemberWithCategory | null> {
  const result = await prisma.member.updateMany({ where: { id: memberId, workspaceId }, data });
  if (result.count === 0) return null;
  return getMember(workspaceId, memberId);
}

export function listMemberCategories(
  workspaceId: string,
  options: { onlyActive?: boolean } = {},
): Promise<MemberCategory[]> {
  return prisma.memberCategory.findMany({
    where: { workspaceId, isActive: options.onlyActive ? true : undefined },
    orderBy: { order: "asc" },
  });
}

export function getMemberCategory(workspaceId: string, categoryId: string): Promise<MemberCategory | null> {
  return prisma.memberCategory.findFirst({ where: { id: categoryId, workspaceId } });
}

export function createMemberCategory(
  workspaceId: string,
  input: { name: string; description?: string | null; order?: number },
): Promise<MemberCategory> {
  return prisma.memberCategory.create({
    data: {
      workspaceId,
      name: input.name,
      description: input.description ?? null,
      order: input.order ?? 0,
    },
  });
}

export type UpdateMemberCategoryInput = {
  name?: string;
  description?: string | null;
  order?: number;
  isActive?: boolean;
};

export async function updateMemberCategory(
  workspaceId: string,
  categoryId: string,
  data: UpdateMemberCategoryInput,
): Promise<MemberCategory | null> {
  const result = await prisma.memberCategory.updateMany({ where: { id: categoryId, workspaceId }, data });
  if (result.count === 0) return null;
  return getMemberCategory(workspaceId, categoryId);
}
