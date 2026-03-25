"use server";

import { prisma } from "@repo/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "../lib/auth";
import { resolveActiveOrganizationForUser } from "../lib/fotorank/dashboard-org-context";
import { isEvaluableFotorankContestEntry } from "../lib/fotorank/fotorankContestEntryDomain";
import { routes } from "../lib/routes";

export type CreateFotorankContestEntryResult =
  | { ok: true; entryId: string }
  | { ok: false; error: string };

/**
 * Crea una obra FotoRank en una categoría del concurso (pipeline operativo / admin).
 * Valida org activa y pertenencia concurso↔categoría. No reemplaza un futuro flujo público de inscripción.
 */
export async function createFotorankContestEntry(input: {
  contestId: string;
  categoryId: string;
  imageUrl: string;
  title?: string | null;
  description?: string | null;
  authorUserId?: number | null;
}): Promise<CreateFotorankContestEntryResult> {
  const user = await requireAuth();
  const org = await resolveActiveOrganizationForUser(user.id);
  if (!org.ok) return { ok: false, error: org.error };

  const contestId = input.contestId.trim();
  const categoryId = input.categoryId.trim();
  const imageUrl = input.imageUrl.trim();
  if (!contestId || !categoryId) return { ok: false, error: "Concurso y categoría son obligatorios." };
  if (!imageUrl) return { ok: false, error: "La URL o ruta de imagen es obligatoria." };

  const contest = await prisma.fotorankContest.findFirst({
    where: { id: contestId, organizationId: org.org.id },
    select: { id: true },
  });
  if (!contest) return { ok: false, error: "Concurso no encontrado en tu organización activa." };

  const category = await prisma.fotorankContestCategory.findFirst({
    where: { id: categoryId, contestId },
    select: { id: true },
  });
  if (!category) return { ok: false, error: "La categoría no pertenece a ese concurso." };

  const draft = {
    contestId,
    categoryId,
    imageUrl,
    title: input.title?.trim() || null,
    description: input.description?.trim() || null,
    authorUserId: input.authorUserId ?? null,
  };
  if (!isEvaluableFotorankContestEntry(draft)) {
    return { ok: false, error: "Los datos de la obra no cumplen las reglas mínimas para ser evaluable." };
  }

  const entry = await prisma.fotorankContestEntry.create({
    data: {
      contestId,
      categoryId,
      imageUrl,
      title: draft.title,
      description: draft.description,
      authorUserId: draft.authorUserId,
    },
    select: { id: true },
  });

  revalidatePath(routes.dashboard.concursos.detalle(contestId));
  revalidatePath("/jurados/asignaciones");
  return { ok: true, entryId: entry.id };
}
