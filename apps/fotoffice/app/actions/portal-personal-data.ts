"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { guardarDatosPersonales } from "@/lib/portal/save-personal-data";

export type PortalPersonalDataState = {
  error: string | null;
  field?: string;
  ok: string | null;
};

/**
 * El socio guarda sus datos personales desde el portal.
 *
 * La autorización se resuelve adentro, no en la pantalla: una acción de servidor se puede
 * invocar con un POST armado a mano, sin pasar por ninguna interfaz. `requireAuth` da la
 * sesión y `guardarDatosPersonales` resuelve la ficha a partir de ella — el formulario no
 * manda ningún identificador de socio, y por eso no hay nada que falsificar.
 *
 * Los campos que llegan vacíos se guardan en null a propósito: el formulario manda todos, así
 * que un campo vacío significa "lo borré", no "no lo toqué".
 */
export async function savePortalPersonalDataAction(
  _prev: PortalPersonalDataState,
  formData: FormData,
): Promise<PortalPersonalDataState> {
  const user = await requireAuth();

  const texto = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : null;
  };

  const r = await guardarDatosPersonales(user.id, {
    firstName: texto("firstName"),
    lastName: texto("lastName"),
    documentType: texto("documentType"),
    documentNumber: texto("documentNumber"),
    email: texto("email"),
    phone: texto("phone"),
    birthDate: texto("birthDate"),
    address: texto("address"),
    city: texto("city"),
    province: texto("province"),
    postalCode: texto("postalCode"),
  });

  if (!r.ok) return { error: r.error, field: r.field, ok: null };

  // El nombre y la foto viven en el encabezado del portal, y el carnet los imprime: si no se
  // revalidan, el socio guarda su apellido corregido y lo sigue viendo mal arriba.
  revalidatePath("/portal", "layout");
  return { error: null, ok: "Listo, guardamos tus datos." };
}
