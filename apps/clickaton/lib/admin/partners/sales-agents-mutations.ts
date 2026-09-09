"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setSalesAgentStatus, upsertSalesAgent } from "@repo/db/partners-sales-agents";
import { requireClickatonAdmin } from "@/lib/admin/auth";

/**
 * Habilitar y suspender vendedores de inventario.
 *
 * Habilitar a alguien a ofrecer la red es una decisión con consecuencias
 * comerciales, así que vive en el panel de DNX y no en el de cada organizador.
 */

const RUTA = "/admin/sponsors/vendedores";

function volver(mensaje: string, tipo: "ok" | "error"): never {
  redirect(`${RUTA}?${tipo}=${encodeURIComponent(mensaje)}`);
}

export async function guardarVendedorAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();

  const organizationId = String(formData.get("organizationId") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const canSellPlatform = formData.get("canSellPlatform") === "on";
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!organizationId) volver("Falta el identificador de la organización.", "error");
  if (!displayName) volver("Poné un nombre para reconocerlo en las pantallas.", "error");

  const guardado = await upsertSalesAgent({
    organizationId,
    displayName,
    canSellPlatform,
    notes,
    userId: user.id,
  });

  revalidatePath(RUTA);
  volver(
    guardado.canSellPlatform
      ? `${guardado.displayName} puede ofrecer los espacios de la red.`
      : `${guardado.displayName} queda habilitado solo para su propio inventario.`,
    "ok",
  );
}

export async function cambiarEstadoVendedorAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const organizationId = String(formData.get("organizationId") ?? "").trim();
  const suspender = formData.get("suspender") === "true";

  const resultado = await setSalesAgentStatus({
    organizationId,
    status: suspender ? "SUSPENDED" : "ACTIVE",
    userId: user.id,
  });
  if (!resultado.ok) volver("No se encontró ese vendedor.", "error");

  revalidatePath(RUTA);
  volver(suspender ? "Vendedor suspendido." : "Vendedor reactivado.", "ok");
}
