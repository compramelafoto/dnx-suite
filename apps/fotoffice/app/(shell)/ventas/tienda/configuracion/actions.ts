"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireStoreConfigurer } from "@/lib/store/access";
import { parseSettingsForm } from "@/lib/store/settings-form";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";

/**
 * Guarda la configuración de la tienda online del workspace activo.
 *
 * Devuelve un resultado en vez de redirigir: la llama el formulario desde el navegador, y un
 * error no tiene que borrar lo que la persona escribió.
 */

export type StoreSettingsActionResult = { ok: true } | { ok: false; error: string };

const SIN_MERCADO_PAGO = "Para abrir la tienda primero conectá Mercado Pago en Configuración → Cobros.";

export async function saveStoreSettingsAction(formData: FormData): Promise<StoreSettingsActionResult> {
  const { workspace } = await requireStoreConfigurer();

  const parsed = parseSettingsForm(formData);
  if (!parsed.ok) return parsed;
  const values = parsed.values;

  // Abrir sin cuenta de cobro dejaría al comprador frente a un botón de pagar que falla. Se
  // verifica cada vez que se guarda abierta (no sólo al pasar de cerrada a abierta): una
  // cuenta desconectada después tampoco puede seguir vendiendo por un guardado cualquiera.
  if (values.isOpen) {
    const collector = await resolveWorkspaceCollector(workspace.id);
    if (!collector.ok) return { ok: false, error: SIN_MERCADO_PAGO };
  }

  await prisma.storeSettings.upsert({
    where: { workspaceId: workspace.id },
    create: { workspaceId: workspace.id, ...values },
    update: values,
  });

  revalidatePath("/ventas/tienda/configuracion");
  // El menú del sitio público muestra la tienda sólo abierta.
  revalidatePath("/w/[workspaceSlug]", "layout");
  return { ok: true };
}
