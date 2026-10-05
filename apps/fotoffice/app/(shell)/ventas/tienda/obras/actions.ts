"use server";

import { revalidatePath } from "next/cache";
import { requireStoreConfigurer } from "@/lib/store/access";
import { linkOrganization, OrganizationLinkError, unlinkOrganization } from "@/lib/store/artworks/links";

/**
 * Acciones de la pantalla de obras. Todas pasan por `requireStoreConfigurer` y toman el
 * workspace y la persona de la sesión, nunca del formulario. Vincular vuelve a comprobar el
 * rol en los dos lados (`linkOrganization`).
 */

export type ArtworksActionResult = { ok: true; message?: string } | { ok: false; error: string };

const RUTA = "/ventas/tienda/obras";

export async function linkOrganizationAction(formData: FormData): Promise<ArtworksActionResult> {
  const { user, workspace } = await requireStoreConfigurer();
  const organizationId = formData.get("organizationId");
  if (typeof organizationId !== "string" || organizationId === "") {
    return { ok: false, error: "Elegí una organización." };
  }
  try {
    const { created } = await linkOrganization(workspace.id, organizationId, user.id);
    revalidatePath(RUTA);
    return { ok: true, message: created ? "Listo, la organización quedó vinculada." : "Esa organización ya estaba vinculada." };
  } catch (error) {
    if (error instanceof OrganizationLinkError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function unlinkOrganizationAction(organizationId: string): Promise<ArtworksActionResult> {
  const { workspace } = await requireStoreConfigurer();
  if (typeof organizationId !== "string" || organizationId === "") return { ok: false, error: "Falta la organización." };
  await unlinkOrganization(workspace.id, organizationId);
  revalidatePath(RUTA);
  return { ok: true, message: "Se quitó el vínculo." };
}
