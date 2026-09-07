"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { requestPrintedCard } from "@/lib/carnet/print-order";
import { formatMinorArs } from "@/lib/membership/money";

export type RequestPrintedCardResult =
  | { ok: true; message: string; payPath: string }
  | { ok: false; error: string };

/**
 * El socio pide su tarjeta impresa.
 *
 * Genera el cargo por el valor de una cuota. No se abre un cobro aparte: el cargo entra al
 * mismo circuito de cuotas, con el mismo checkout y el mismo webhook. Un segundo canal sería
 * otra conciliación y otro lugar donde perder plata.
 *
 * Pero tampoco se lo deja esperando. La idea de "se paga junto con tus cuotas" se cae para
 * quien acaba de pagar la inscripción: no le queda ninguna cuota con la cual juntarlo, y la
 * tarjeta quedaría sin imprimir hasta el mes siguiente. Por eso se devuelve el destino de
 * pago y la pantalla lo ofrece ahí mismo.
 */
export async function requestPrintedCardAction(): Promise<RequestPrintedCardResult> {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) return { ok: false, error: "No encontramos tu ficha de socio." };

  const r = await requestPrintedCard({
    workspaceId: context.workspace.id,
    memberId: context.member.id,
  });
  if (!r.ok) return r;

  revalidatePath("/portal/carnet");
  revalidatePath("/portal/cuotas");
  // Si el saldo a favor ya cubrió el cargo, decir "cuando lo pagues" sería mentirle: la
  // tarjeta ya está en la cola, no esperando un pago que no va a hacer falta.
  const message = r.settledByCredit
    ? `Listo. Tu saldo a favor cubrió el cargo de ${formatMinorArs(r.amountMinor)}. La tarjeta ya está en la cola de impresión.`
    : `Listo. Se agregó un cargo de ${formatMinorArs(r.amountMinor)}. Cuando lo pagues, la tarjeta entra en la cola de impresión.`;
  return {
    ok: true,
    message,
    payPath: "/portal/cuotas",
  };
}
