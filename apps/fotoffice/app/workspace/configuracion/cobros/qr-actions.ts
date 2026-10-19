"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canManageWorkspaceCollection } from "@/lib/payments/connect/authz";
import { activarQrMostrador } from "@/lib/sales/qr-mp-servidor";

/** "Activar QR del mostrador": sólo dueño o administrador, como conectar Mercado Pago. */
export async function activarQrMostradorAction(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) return { ok: false, error: "No hay un espacio activo." };
  if (!(await canManageWorkspaceCollection(user.id, workspace.id))) return { ok: false, error: "Solo el dueño o un administrador puede activar el QR." };
  const t = (k: string) => String(formData.get(k) ?? "").trim();
  const num = (k: string) => Number(t(k).replace(",", "."));
  const r = await activarQrMostrador(workspace.id, user.id, {
    nombre: t("nombre"),
    calle: t("calle"),
    numero: t("numero"),
    ciudad: t("ciudad"),
    provincia: t("provincia"),
    latitud: num("latitud"),
    longitud: num("longitud"),
    referencia: t("referencia") || null,
  });
  if (r.ok) {
    revalidatePath("/workspace/configuracion/cobros");
    revalidatePath("/ventas");
  }
  return r;
}
