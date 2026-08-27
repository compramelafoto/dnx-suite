"use server";

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { claimMembership } from "@/lib/portal/claim";

export type ClaimState = { error: string | null };

/**
 * El socio confirma que esa ficha es suya.
 *
 * Explícito a propósito: coincidir el email habilita a preguntar, no a vincular solo. Es el
 * mismo criterio que gobierna la invitación — autenticarse no es lo mismo que consentir.
 */
export async function claimMembershipAction(
  _prev: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const user = await requireAuth();
  const memberId = String(formData.get("memberId") ?? "").trim();
  if (!memberId) return { error: "Falta la ficha a vincular." };

  const r = await claimMembership({ userId: user.id, email: user.email, memberId });
  if (!r.ok) return { error: r.error };

  redirect("/portal");
}
