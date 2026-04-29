"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { z } from "zod";
import { requireEvaluacionesContext } from "@/lib/workspace";

const createEvaluationContextSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio.").max(200, "El nombre es demasiado largo."),
  description: z.string().max(2000, "La descripción es demasiado larga.").optional().nullable(),
});

export type EvaluationContextFormState = { error: string | null; ok?: boolean };

export async function listEvaluationContextsAction() {
  const { workspace } = await requireEvaluacionesContext();
  return prisma.evaluationContext.findMany({
    where: { workspaceId: workspace.id },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export const listEvaluationContexts = listEvaluationContextsAction;

export async function createEvaluationContextAction(
  _prev: EvaluationContextFormState | undefined,
  formData: FormData,
): Promise<EvaluationContextFormState> {
  const { workspace, user } = await requireEvaluacionesContext();
  const parsed = createEvaluationContextSchema.safeParse({
    name: formData.get("name")?.toString()?.trim() ?? "",
    description: formData.get("description")?.toString()?.trim() ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  try {
    await prisma.evaluationContext.create({
      data: {
        workspaceId: workspace.id,
        name: data.name,
        description: data.description ? data.description : null,
        ownerType: "manual",
        ownerId: null,
        createdById: String(user.id),
      },
      select: { id: true },
    });
    revalidatePath("/evaluaciones");
    return { error: null, ok: true };
  } catch {
    return { error: "No se pudo crear el contexto de evaluación." };
  }
}
