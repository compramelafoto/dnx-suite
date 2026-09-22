/**
 * Leer el padrón maestro y asignar jurados a una maratón.
 *
 * Dos bases, dos clientes, y cada cosa se escribe donde corresponde: la
 * identidad se lee de FotoRank y el trabajo se crea en Clickatón, que es donde
 * están las obras.
 */

import { mirrorJudgeAccount } from "../jury-mirror/mirror-judge";
import {
  categoriasQueFaltanAsignar,
  sePuedeAsignar,
  type JuradoDelPadron,
} from "./assign-judge";

/** Lo mínimo que hace falta del padrón maestro, declarado para poder probarlo. */
export type PadronPrisma = {
  fotorankJudgeAccount: {
    findMany(args: {
      where: Record<string, unknown>;
      select: Record<string, unknown>;
      orderBy?: unknown;
      take?: number;
    }): Promise<
      Array<{
        id: string;
        email: string;
        accountStatus: string;
        profile: {
          firstName: string | null;
          lastName: string | null;
          directoryReviewStatus: string;
        } | null;
      }>
    >;
  };
};

/** Lo mínimo que hace falta de la base de la maratón. */
export type MaratonPrisma = {
  fotorankJudgeAssignment: {
    findMany(args: {
      where: Record<string, unknown>;
      select: Record<string, unknown>;
    }): Promise<Array<{ judgeAccountId: string; categoryId: string }>>;
    createMany(args: { data: Array<Record<string, unknown>> }): Promise<unknown>;
  };
} & Parameters<typeof mirrorJudgeAccount>[0]["prisma"];

/**
 * Los jurados del padrón que pueden recibir trabajo.
 *
 * Trae a todos y filtra acá, en vez de armar la condición en la consulta,
 * porque el criterio de "se le puede asignar" vive en un solo lugar y tiene
 * pruebas. Son decenas de filas, no miles.
 */
export async function listarJuradosAsignables(
  padron: PadronPrisma | null,
): Promise<JuradoDelPadron[] | null> {
  if (!padron) return null;

  const filas = await padron.fotorankJudgeAccount.findMany({
    where: { accountStatus: "ACTIVE" },
    select: {
      id: true,
      email: true,
      accountStatus: true,
      profile: {
        select: { firstName: true, lastName: true, directoryReviewStatus: true },
      },
    },
    orderBy: { email: "asc" },
    take: 200,
  });

  return filas
    .map((f) => ({
      id: f.id,
      email: f.email,
      accountStatus: f.accountStatus,
      directoryReviewStatus: f.profile?.directoryReviewStatus ?? "PENDING",
      nombre:
        [f.profile?.firstName, f.profile?.lastName].filter(Boolean).join(" ").trim() || null,
    }))
    .filter((j) => sePuedeAsignar(j).ok);
}

export type ResultadoDeAsignacion =
  | { ok: true; creadas: number; yaEstaban: number }
  | { ok: false; error: string };

/**
 * Asigna un jurado del padrón a categorías de una maratón.
 *
 * El orden importa: primero la ficha espejo —que crea también el workspace que
 * la sostiene— y después la asignación. Al revés es imposible, porque la
 * asignación tiene clave foránea a la ficha.
 *
 * Si la ficha se crea y la asignación falla, queda una ficha huérfana. Es
 * inofensiva: no autentica a nadie y el siguiente intento la reutiliza.
 */
export async function asignarJuradoAMaraton(input: {
  padron: PadronPrisma | null;
  maraton: MaratonPrisma | null;
  judgeAccountId: string;
  organizationId: string;
  contestId: string;
  categoryIds: string[];
  createdByUserId: number;
  methodType: string;
  methodConfigJson?: unknown;
  evaluationStartsAt?: Date | null;
  evaluationEndsAt?: Date | null;
}): Promise<ResultadoDeAsignacion> {
  if (!input.padron) return { ok: false, error: "SIN_PADRON" };
  if (!input.maraton) return { ok: false, error: "SIN_MARATON" };
  if (input.categoryIds.length === 0) {
    return { ok: false, error: "Elegí al menos una categoría." };
  }

  // La identidad se valida contra el maestro, nunca contra la copia.
  const asignables = await listarJuradosAsignables(input.padron);
  const jurado = asignables?.find((j) => j.id === input.judgeAccountId);
  if (!jurado) {
    return { ok: false, error: "Ese jurado no está disponible para asignar." };
  }

  const yaAsignadas = await input.maraton.fotorankJudgeAssignment.findMany({
    where: { contestId: input.contestId, judgeAccountId: input.judgeAccountId },
    select: { judgeAccountId: true, categoryId: true },
  });

  const faltan = categoriasQueFaltanAsignar({
    judgeAccountId: input.judgeAccountId,
    categoryIds: input.categoryIds,
    yaAsignadas,
  });
  const yaEstaban = new Set(input.categoryIds).size - faltan.length;

  if (faltan.length === 0) {
    return { ok: true, creadas: 0, yaEstaban };
  }

  await mirrorJudgeAccount({
    prisma: input.maraton,
    judge: { id: jurado.id, email: jurado.email },
  });

  await input.maraton.fotorankJudgeAssignment.createMany({
    data: faltan.map((categoryId) => ({
      judgeAccountId: input.judgeAccountId,
      organizationId: input.organizationId,
      contestId: input.contestId,
      categoryId,
      assignmentType: "PRIMARY",
      assignmentStatus: "ASSIGNED",
      methodType: input.methodType,
      methodConfigJson: input.methodConfigJson ?? {},
      allowVoteEdit: true,
      commentsVisibleToParticipants: false,
      createdByUserId: input.createdByUserId,
      evaluationStartsAt: input.evaluationStartsAt ?? null,
      evaluationEndsAt: input.evaluationEndsAt ?? null,
    })),
  });

  return { ok: true, creadas: faltan.length, yaEstaban };
}
