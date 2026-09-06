"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { createAdvanceCharges } from "@/lib/membership/advance-store";

export type AdvanceDuesResult =
  | { ok: true; payPath: string }
  | { ok: false; error: string };

/**
 * Crea los cargos adelantados y devuelve a dónde ir a pagarlos.
 *
 * No cobra acá: los cargos entran al circuito normal de cuotas y se pagan con el mismo botón
 * que el resto. Un cobro aparte sería una segunda forma de pagar una cuota, y dos caminos
 * para lo mismo terminan divergiendo.
 */
export async function advanceDuesAction(months: number): Promise<AdvanceDuesResult> {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) return { ok: false, error: "No encontramos tu ficha de socio." };

  const r = await createAdvanceCharges({ memberId: context.member.id, months });
  if (!r.ok) return r;

  revalidatePath("/portal/cuotas");
  return { ok: true, payPath: "/portal/cuotas" };
}
