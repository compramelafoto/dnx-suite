"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { createAdvanceCharges } from "@/lib/membership/advance-store";
import { getWorkspaceCollectionStatus } from "@/lib/payments/connect/status";

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
  // `months` llega del cliente: un entero mayor que cero es lo único que tiene sentido
  // pedirle a `createAdvanceCharges`, que confía en que ya viene validado.
  if (!Number.isInteger(months) || months <= 0) {
    return { ok: false, error: "Elegí cuántos meses querés adelantar." };
  }

  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) return { ok: false, error: "No encontramos tu ficha de socio." };

  // La pantalla esconde esta opción si la institución no puede cobrar, pero esconder un
  // botón no es un control: esta acción es la única puerta a crear deuda desde el portal, y
  // tiene que validarlo del lado del servidor igual que lo hace el resto del circuito de
  // cuotas (ver `submitApplicationAction`).
  const cobros = await getWorkspaceCollectionStatus(context.workspace.id);
  if (!cobros.canCharge) {
    return { ok: false, error: `${context.workspace.name} todavía no habilitó el cobro en línea.` };
  }

  const r = await createAdvanceCharges({ memberId: context.member.id, months });
  if (!r.ok) return r;

  revalidatePath("/portal/cuotas");
  return { ok: true, payPath: "/portal/cuotas" };
}
