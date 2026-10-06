"use server";

import { revalidatePath } from "next/cache";
import { requireStoreConfigurer } from "@/lib/store/access";
import { markAuthorMonthPaid } from "@/lib/store/artworks/royalties";

/**
 * "Marcar pagado" de un autor en un mes. Permiso y workspace salen de la sesión
 * (`requireStoreConfigurer`); del formulario sólo el autor, el mes, las regalías que se vieron y la referencia.
 */

export type RoyaltiesActionResult = { ok: true; message: string } | { ok: false; error: string };

export async function markAuthorMonthPaidAction(formData: FormData): Promise<RoyaltiesActionResult> {
  const { workspace, user } = await requireStoreConfigurer();
  const r = await markAuthorMonthPaid({
    workspaceId: workspace.id,
    authorUserId: Number(formData.get("authorUserId")),
    month: String(formData.get("month") ?? ""),
    royaltyIds: formData.getAll("royaltyId"),
    reference: formData.get("reference"),
    userId: user.id,
  });
  if (!r.ok) return r;
  revalidatePath("/ventas/tienda/obras/regalias");
  const hecho = r.count === 1 ? "Se marcó 1 regalía como pagada." : `Se marcaron ${r.count} regalías como pagadas.`;
  return {
    ok: true,
    message: r.partial ? `${hecho} Algunas regalías cambiaron mientras tanto; revisá el resumen.` : hecho,
  };
}
