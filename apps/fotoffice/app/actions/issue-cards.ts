"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canManageWorkspaceCollection } from "@/lib/payments/connect/authz";
import { issueMissingDigitalCards } from "@/lib/carnet/issue";

export type IssueCardsResult =
  | { ok: true; emitidos: number; yaTenian: number; omitidos: number }
  | { ok: false; error: string };

/**
 * Emite el carnet digital de todos los socios activos que no tengan uno vigente.
 *
 * Se puede correr las veces que haga falta: no duplica carnets. Por eso no hace falta
 * avisarle a nadie antes de apretar, ni deshabilitar el botón después.
 */
export async function issueDigitalCardsAction(): Promise<IssueCardsResult> {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) return { ok: false, error: "No hay una institución activa." };

  const puede = await canManageWorkspaceCollection(user.id, workspace.id);
  if (!puede) {
    return { ok: false, error: "Solo el dueño o un administrador puede emitir carnets." };
  }

  const reporte = await issueMissingDigitalCards(workspace.id);
  revalidatePath("/members/carnets");
  return { ok: true, ...reporte };
}
