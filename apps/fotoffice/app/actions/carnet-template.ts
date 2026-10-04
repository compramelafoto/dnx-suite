"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspace } from "@/lib/workspace";
import { createCarnetTemplate } from "@/lib/carnet/template-store";
import { canDesignTemplates } from "@/lib/template-v2/access";

export type CarnetTemplateState = { error: string | null; ok: string | null };

/**
 * Copia el diseño de fábrica del carnet a una plantilla editable de la institución.
 *
 * Explícita a propósito: crear datos por visitar una pantalla es justamente lo que el resto de
 * FotoOffice evita.
 */
export async function createCarnetTemplateAction(): Promise<CarnetTemplateState> {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) return { error: "No hay una institución activa.", ok: null };

  if (!(await canDesignTemplates(user.id, workspace.id))) {
    return { error: "No tenés permiso para crear plantillas: hace falta gestionar Socios.", ok: null };
  }

  const r = await createCarnetTemplate({ workspaceId: workspace.id, userId: user.id });
  if (!r.ok) return { error: r.error, ok: null };

  revalidatePath("/members/disenador");
  return {
    error: null,
    ok: r.created
      ? "Listo. La plantilla del carnet ya se puede editar."
      : "Esa plantilla ya existía.",
  };
}
