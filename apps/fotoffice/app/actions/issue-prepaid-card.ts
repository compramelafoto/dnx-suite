"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canAdministerCards } from "@/lib/carnet/operators";
import { requestPrintedCard } from "@/lib/carnet/print-order";

export type IssuePrepaidCardResult =
  | { ok: true; cardNumber: string }
  | { ok: false; error: string };

/**
 * La Secretaría emite la tarjeta impresa que un socio ya pagó.
 *
 * Nunca crea un cargo (`requirePrepaid`): sólo engancha la tarjeta al que ya está saldado, y
 * por eso entra directo a la cola de impresión. Mismo permiso que emitir carnets digitales.
 */
export async function issuePrepaidCardAction(memberId: string): Promise<IssuePrepaidCardResult> {
  if (typeof memberId !== "string" || memberId.length === 0) {
    return { ok: false, error: "Falta indicar a quién." };
  }
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) return { ok: false, error: "No hay una institución activa." };

  const puede = await canAdministerCards(user.id, workspace.id);
  if (!puede) {
    return { ok: false, error: "Solo quien administra los carnets puede emitirlos." };
  }

  const r = await requestPrintedCard({
    workspaceId: workspace.id,
    memberId,
    requirePrepaid: true,
    actorLabel: `Emitida desde el panel por ${user.name?.trim() || user.email || "la Secretaría"}`,
    actorUserId: user.id,
  });
  if (!r.ok) return r;

  revalidatePath("/members/carnets");
  return { ok: true, cardNumber: r.cardNumber };
}
