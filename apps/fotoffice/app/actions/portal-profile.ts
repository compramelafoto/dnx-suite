"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { guardarPerfilProfesional } from "@/lib/portal/professional-profile";

export type PortalProfileState = {
  error: string | null;
  field?: string;
  ok: string | null;
};

/**
 * El socio actualiza su presencia profesional desde el portal.
 *
 * Los campos que no llegan se guardan en null a propósito: el formulario manda todos, así que
 * un campo vacío significa "lo borré", no "no lo toqué".
 */
export async function savePortalProfileAction(
  _prev: PortalProfileState,
  formData: FormData,
): Promise<PortalProfileState> {
  const user = await requireAuth();

  const texto = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : null;
  };

  const r = await guardarPerfilProfesional(user.id, {
    businessName: texto("businessName"),
    bio: texto("bio"),
    specialties: formData.getAll("specialties").map(String),
    website: texto("website"),
    instagram: texto("instagram"),
    tiktok: texto("tiktok"),
    facebook: texto("facebook"),
    youtube: texto("youtube"),
    linkedin: texto("linkedin"),
    directoryOptIn: formData.get("directoryOptIn") === "on",
  });

  if (!r.ok) return { error: r.error, field: r.field, ok: null };

  revalidatePath("/portal");
  revalidatePath("/portal/perfil");
  return { error: null, ok: "Listo, guardamos tus datos." };
}
