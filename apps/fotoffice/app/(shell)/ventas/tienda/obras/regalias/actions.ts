"use server";

import { revalidatePath } from "next/cache";
import { requireStoreConfigurer } from "@/lib/store/access";
import { markAuthorMonthPaid } from "@/lib/store/artworks/royalties";

/**
 * "Marcar pagado" de un autor en un mes. Permiso y workspace salen de la sesión
 * (`requireStoreConfigurer`); del formulario sólo el autor, el mes y la referencia.
 */

export type RoyaltiesActionResult = { ok: true; message: string } | { ok: false; error: string };

export async function markAuthorMonthPaidAction(formData: FormData): Promise<RoyaltiesActionResult> {
  const { workspace, user } = await requireStoreConfigurer();
  const r = await markAuthorMonthPaid({
    workspaceId: workspace.id,
    authorUserId: Number(formData.get("authorUserId")),
    month: String(formData.get("month") ?? ""),
    reference: formData.get("reference"),
    userId: user.id,
  });
  if (!r.ok) return r;
  revalidatePath("/ventas/tienda/obras/regalias");
  return { ok: true, message: r.count === 1 ? "Se marcó 1 regalía como pagada." : `Se marcaron ${r.count} regalías como pagadas.` };
}
