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
 * ── Por qué no lee la base propia ──
 *
 * Las fichas de `DnxPartner` se cargan desde el panel de Partners, que vive en Clickatón y
 * escribe en la base de Clickatón. Aunque las cinco aplicaciones comparten `schema.prisma`,
 * cada una tiene SU base: en la de FotOffice la tabla existe pero está casi vacía, y buscar
 * ahí no encuentra ninguna de las marcas que la institución tiene registradas.
 *
 * Se lee entonces con el cliente de sólo lectura hacia Clickatón, que es el mismo camino que
 * ya usa FotoRank para los concursos publicados. Nunca escribe: el proxy bloquea toda
 * operación que no sea de lectura.
 *
 * Si la conexión no está configurada, cae a la base propia en vez de romper el formulario:
 * el aliado siempre se puede escribir a mano, y un buscador vacío es mejor que una pantalla
 * que no carga. La elección de la base vive en `lib/sponsors/clients.ts`.
 */
export async function searchPartners(workspaceId: string, texto: string): Promise<PartnerOption[]> {
  try {
    // El buscador de la base común, con el mismo filtro que el módulo de sponsors: de los
    // sponsors ajenos a la institución sólo se ve nombre y logo, nunca su email. Antes este
    // buscador devolvía el email de cualquier sponsor de la red.
    const { searchCatalog } = await import("@/lib/sponsors/repository");
    const opciones = await searchCatalog(workspaceId, texto);
    return opciones.slice(0, 10).map((o) => ({ id: o.id, name: o.name, logoUrl: o.logoUrl, email: o.email }));
  } catch (error) {
    // Que el panel de aliados esté caído no puede impedir cargar un premio.
    console.error("[fotoffice][sorteos] no se pudo leer los aliados de Partners", {
      detalle: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export type PartnerOption = {
  id: string;
  name: string;
  logoUrl: string | null;
  email: string | null;
};
