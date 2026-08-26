"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { requestPrintedCard } from "@/lib/carnet/print-order";
import { formatMinorArs } from "@/lib/membership/money";

export type RequestPrintedCardResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * El socio pide su tarjeta impresa.
 *
 * Genera el cargo por el valor de una cuota. No cobra acá: el cargo aparece en «Tus cuotas»
 * y se paga con el resto, por el mismo circuito. Un pago aparte sería otra conciliación y
 * otro lugar donde perder plata.
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
  return {
    ok: true,
    message: `Listo. Se agregó un cargo de ${formatMinorArs(r.amountMinor)} a tus cuotas. Cuando lo pagues, la tarjeta entra en la cola de impresión.`,
  };
}
