import "server-only";
import { prisma } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";
import type { MemberForRaffle } from "./eligibility";

/**
 * Única puerta a las cinco tablas de sorteos.
 *
 * Su trabajo es juntar lo que el núcleo puro necesita y devolvérselo resuelto. El núcleo no
 * sabe de Prisma, y por eso se puede verificar sin montar una base.
 *
 * Toda consulta lleva `workspaceId`.
 */

export async function listRaffles(workspaceId: string) {
  return prisma.raffle.findMany({
    where: { workspaceId },
    orderBy: { drawsAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      entriesCloseAt: true,
      drawsAt: true,
      entrantsCount: true,
      cancelReason: true,
      _count: { select: { prizes: true } },
    },
  });
}

export async function loadRaffle(workspaceId: string, raffleId: string) {
  return prisma.raffle.findFirst({
    where: { id: raffleId, workspaceId },
    include: {
      prizes: {
        orderBy: { order: "asc" },
        include: {
          award: {
            include: {
              member: {
                select: {
                  id: true,
                  memberNumber: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
      },
      entries: { orderBy: { position: "asc" } },
      events: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
}

/**
 * Los socios con sus cargos impagos, para decidir quién entra en el padrón.
 *
 * Trae TODOS los socios, no sólo los activos: la regla de elegibilidad decide, y que decida
 * un único lugar es lo que hace que la pantalla del socio y el sellado nunca discrepen.
 */
export async function loadMembersForRaffle(workspaceId: string): Promise<MemberForRaffle[]> {
  const filas = await prisma.member.findMany({
    where: { workspaceId },
    select: {
      id: true,
      memberNumber: true,
      firstName: true,
      lastName: true,
      status: true,
      charges: {
        where: { balanceArs: { gt: 0 } },
        select: { period: true, dueDate: true, balanceArs: true },
      },
    },
  });

  return filas.map((m) => ({
    memberId: m.id,
    memberNumber: m.memberNumber,
    fullName: `${m.firstName} ${m.lastName}`.trim(),
    status: String(m.status),
    charges: m.charges.map((c) => ({
      period: c.period,
      dueDate: c.dueDate,
      balanceMinor: decimalArsToMinor(c.balanceArs),
    })),
  }));
}

/**
 * La situación de UN socio, para su propia pantalla del portal.
 *
 * Existe aparte de `loadMembersForRaffle` porque traer los 110 socios para contestarle a uno
 * sería leer de más en la página que más se abre.
 */
export async function loadMemberForRaffle(
  workspaceId: string,
  memberId: string,
): Promise<MemberForRaffle | null> {
  const m = await prisma.member.findFirst({
    where: { id: memberId, workspaceId },
    select: {
      id: true,
      memberNumber: true,
      firstName: true,
      lastName: true,
      status: true,
      charges: {
        where: { balanceArs: { gt: 0 } },
        select: { period: true, dueDate: true, balanceArs: true },
      },
    },
  });
  if (!m) return null;

  return {
    memberId: m.id,
    memberNumber: m.memberNumber,
    fullName: `${m.firstName} ${m.lastName}`.trim(),
    status: String(m.status),
    charges: m.charges.map((c) => ({
      period: c.period,
      dueDate: c.dueDate,
      balanceMinor: decimalArsToMinor(c.balanceArs),
    })),
  };
}

/**
 * Buscador de aliados para el formulario de premios.
 *
 * `DnxPartner` vive en el dominio de Partners, que es otra aplicación. Se lee por nombre y se
 * guarda por id, sin clave foránea: el enganche es mínimo a propósito.
 */
export async function searchPartners(texto: string) {
  const q = texto.trim();
  if (q.length < 2) return [];
  return prisma.dnxPartner.findMany({
    where: { archivedAt: null, name: { contains: q, mode: "insensitive" } },
    orderBy: { name: "asc" },
    take: 10,
    select: { id: true, name: true, logoUrl: true },
  });
}
