"use server";

import { revalidatePath } from "next/cache";
import type { AuthUser } from "@/lib/auth";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canManageWorkspaceCollection } from "@/lib/payments/connect/authz";
import { voidRecommendationBenefit } from "@/lib/membership/recommendation-store";

export type RecommendationActionState = { error: string | null; ok: string | null };

/**
 * Mismo permiso que resolver solicitudes: quien puede aprobar un alta es quien puede anular
 * la bonificación que ese alta generó.
 */
async function requireSecretary(): Promise<
  { ok: true; workspaceId: string; user: AuthUser } | { ok: false; error: string }
> {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) return { ok: false, error: "No hay institución activa." };
  if (!(await canManageWorkspaceCollection(user.id, workspace.id))) {
    return { ok: false, error: "No tenés permiso para anular bonificaciones." };
  }
  return { ok: true, workspaceId: workspace.id, user };
}

/**
 * Anula una bonificación desde la ficha del socio.
 *
 * El motivo es obligatorio: una cuota que vuelve a costar lo que costaba necesita una
 * explicación escrita, o el socio recibe un aumento sin razón visible.
 */
export async function voidRecommendationBenefitAction(
  _prev: RecommendationActionState | undefined,
  formData: FormData,
): Promise<RecommendationActionState> {
  const guard = await requireSecretary();
  if (!guard.ok) return { error: guard.error, ok: null };

  const benefitId = formData.get("benefitId")?.toString()?.trim();
  const memberId = formData.get("memberId")?.toString()?.trim();
  const reason = formData.get("reason")?.toString() ?? "";
  if (!benefitId || !memberId) return { error: "Bonificación inválida.", ok: null };

  const r = await voidRecommendationBenefit({
    benefitId,
    workspaceId: guard.workspaceId,
    userId: guard.user.id,
    reason,
  });
  if (!r.ok) return { error: r.error, ok: null };

  revalidatePath(`/members/${memberId}`);
  return { error: null, ok: "Bonificación anulada." };
}
