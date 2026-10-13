"use server";

import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { loadMemberBalance } from "@/lib/membership/balance";
import { selectChargesToPay } from "@/lib/membership/select-charges";
import { startMemberDuesCheckout } from "@/lib/membership/dues-checkout";

export type StartDuesPaymentResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; error: string };

/**
 * Arranca el pago de cuotas del socio que tiene la sesión abierta.
 *
 * El socio elige **cuántas** cuotas paga, no cuáles: la selección va siempre de la más vieja
 * a la más nueva (ver `select-charges.ts`).
 *
 * El cobro lo abre `startMemberDuesCheckout` (lib/membership/dues-checkout.ts), que comparten
 * el alta sin aprobación y la renovación del club.
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

  const cuantas = seleccion.selection.chargeIds.length;
  const titulo =
    cuantas === 1
      ? `Cuota ${seleccion.selection.oldestPeriod}`
      : `${cuantas} cuotas desde ${seleccion.selection.oldestPeriod}`;

  return startMemberDuesCheckout({
    workspaceId: context.workspace.id,
    memberId: context.member.id,
    memberNumber: context.member.memberNumber,
    totalMinor: seleccion.selection.totalMinor,
    title: titulo,
    returnPath: "/portal/cuotas",
  });
}
