import "server-only";
import { prisma } from "@repo/db";

/**
 * La lista de bienvenidas de Comunicación: un renglón por socio nuevo.
 *
 * La placa no se guarda —se dibuja al pedirla—; acá sólo vive el hecho de que hay que darle la
 * bienvenida y si ya se publicó.
 */

export type WelcomeSource = "AUTO" | "MANUAL";

/**
 * Anota a un socio en la lista. Idempotente: un socio se recibe una sola vez, así que si ya
 * estaba no se toca (ni su marca de publicada).
 */
export async function recordWelcome(input: {
  workspaceId: string;
  memberId: string;
  source: WelcomeSource;
}): Promise<{ created: boolean }> {
  const resultado = await prisma.memberWelcome.createMany({
    data: [{ workspaceId: input.workspaceId, memberId: input.memberId, source: input.source }],
    skipDuplicates: true,
  });
  return { created: resultado.count > 0 };
}

export type WelcomeRow = {
  id: string;
  memberId: string;
  source: string;
  createdAt: Date;
  publishedAt: Date | null;
  publishedByName: string | null;
  member: {
    firstName: string;
    lastName: string;
    memberNumber: string;
    joinedAt: Date;
    avatarUrl: string | null;
    profilePhotoUrl: string | null;
    city: string | null;
    province: string | null;
    studioCity: string | null;
    studioProvince: string | null;
    specialties: string[];
    instagram: string | null;
    status: string;
  };
};

export async function listWelcomes(workspaceId: string): Promise<WelcomeRow[]> {
  const filas = await prisma.memberWelcome.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      memberId: true,
      source: true,
      createdAt: true,
      publishedAt: true,
      publishedByUserId: true,
      member: {
        select: {
          firstName: true,
          lastName: true,
          memberNumber: true,
          joinedAt: true,
          avatarUrl: true,
          profilePhotoUrl: true,
          city: true,
          province: true,
          studioCity: true,
          studioProvince: true,
          specialties: true,
          instagram: true,
          status: true,
        },
      },
    },
  });

  const ids = [...new Set(filas.map((f) => f.publishedByUserId).filter((v): v is number => v != null))];
  const usuarios = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })
    : [];
  const nombre = new Map(usuarios.map((u) => [u.id, u.name?.trim() || u.email]));

  return filas.map((f) => ({
    id: f.id,
    memberId: f.memberId,
    source: f.source,
    createdAt: f.createdAt,
    publishedAt: f.publishedAt,
    publishedByName: f.publishedByUserId != null ? (nombre.get(f.publishedByUserId) ?? null) : null,
    member: f.member,
  }));
}

/** Marca o desmarca "ya publicada". Sólo dentro de la institución dueña del renglón. */
export async function setWelcomePublished(input: {
  workspaceId: string;
  welcomeId: string;
  userId: number;
  published: boolean;
}): Promise<boolean> {
  const r = await prisma.memberWelcome.updateMany({
    where: { id: input.welcomeId, workspaceId: input.workspaceId },
    data: input.published
      ? { publishedAt: new Date(), publishedByUserId: input.userId }
      : { publishedAt: null, publishedByUserId: null },
  });
  return r.count > 0;
}

/** Quita un renglón de la lista: para quien se sumó por error. El socio no se toca. */
export async function removeWelcome(input: { workspaceId: string; welcomeId: string }): Promise<boolean> {
  const r = await prisma.memberWelcome.deleteMany({
    where: { id: input.welcomeId, workspaceId: input.workspaceId },
  });
  return r.count > 0;
}

/**
 * Socios activos que todavía no tienen bienvenida, los más nuevos primero.
 *
 * Es para sumarlos a mano: los que dio de alta un administrador sin pasar por la solicitud y el
 * pago —por ejemplo, los del padrón importado— nunca entran solos a la lista.
 */
export async function listMembersWithoutWelcome(workspaceId: string, take = 50) {
  return prisma.member.findMany({
    where: { workspaceId, status: "ACTIVE", welcome: null },
    orderBy: [{ joinedAt: "desc" }, { memberNumber: "desc" }],
    take,
    select: { id: true, firstName: true, lastName: true, memberNumber: true, joinedAt: true },
  });
}

/** Si el socio es de la institución: para no sumar a la lista a alguien de otra. */
export async function memberBelongsToWorkspace(workspaceId: string, memberId: string): Promise<boolean> {
  const socio = await prisma.member.findFirst({ where: { id: memberId, workspaceId }, select: { id: true } });
  return socio !== null;
}
