/**
 * Lógica compartida para GET /api/public/labs (flujo /imprimir-publico).
 * Paridad legacy: labs activos + búsqueda textual + flag hasWholesalePricing.
 */

import type { PrismaClient } from "@prisma/client";
import { SIN_LABS_SOLO_DIRECTORIO } from "../labs/solo-directorio";

export type PublicLabRow = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  hasWholesalePricing: boolean;
};

/** Campos expuestos al cliente — sin tokens MP ni notas internas. */
export const PUBLIC_LAB_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  address: true,
  city: true,
  province: true,
  country: true,
} as const;

export function buildPublicLabsWhere(search: string | null | undefined) {
  const where: {
    isActive: true;
    isSuspended: false;
    NOT: { tags: { has: string } };
    OR?: Array<Record<string, { contains: string; mode: "insensitive" }>>;
  } = {
    isActive: true,
    isSuspended: false,
    // Los cargados por DNX sin cuenta no pueden recibir pedidos.
    ...SIN_LABS_SOLO_DIRECTORIO,
  };

  const term = (search ?? "").trim();
  if (term) {
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { phone: { contains: term, mode: "insensitive" } },
      { city: { contains: term, mode: "insensitive" } },
      { province: { contains: term, mode: "insensitive" } },
      { address: { contains: term, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function listPublicLabs(
  prisma: PrismaClient,
  search?: string | null
): Promise<PublicLabRow[]> {
  const where = buildPublicLabsWhere(search);

  const labs = await prisma.lab.findMany({
    where,
    select: PUBLIC_LAB_SELECT,
    orderBy: { name: "asc" },
  });

  if (labs.length === 0) return [];

  const counts = await prisma.labProduct.groupBy({
    by: ["labId"],
    where: {
      labId: { in: labs.map((l) => l.id) },
      isActive: true,
      size: { not: null },
    },
    _count: { _all: true },
  });
  const countByLab = new Map(counts.map((c) => [c.labId, c._count._all]));

  return labs.map((lab) => ({
    ...lab,
    hasWholesalePricing: (countByLab.get(lab.id) ?? 0) > 0,
  }));
}
