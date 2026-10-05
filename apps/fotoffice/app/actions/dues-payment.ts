"use server";

import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { loadMemberBalance } from "@/lib/membership/balance";
import { selectChargesToPay } from "@/lib/membership/select-charges";
import { openDuesCheckout } from "@/lib/membership/dues-checkout";

export type StartDuesPaymentResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; error: string };

/**
 * Arranca el pago de cuotas del socio que tiene la sesión abierta.
 *
 * El socio elige **cuántas** cuotas paga, no cuáles: la selección va siempre de la más vieja
 * a la más nueva (ver `select-charges.ts`).
 *
 * El cobro en sí lo arma `openDuesCheckout`.
 */
export async function startDuesPaymentAction(formData: FormData): Promise<StartDuesPaymentResult> {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) {
    return { ok: false, error: "No encontramos tu ficha de socio." };
  }

  const crudo = String(formData.get("howMany") ?? "ALL");
  const howMany = crudo === "ALL" ? "ALL" : Number(crudo);

  const cuenta = await loadMemberBalance(context.member.id);
  const seleccion = selectChargesToPay(cuenta.charges, { howMany });
  if (!seleccion.ok) {
    return { ok: false, error: seleccion.message };
  }

  return openDuesCheckout({
    workspaceId: context.workspace.id,
    memberId: context.member.id,
    memberNumber: context.member.memberNumber,
    selection: seleccion.selection,
    returnPath: "/portal/cuotas",
  });
}
