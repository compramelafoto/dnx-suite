"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { plantillaPorClave } from "@/lib/plantillas";

export type EstadoPlantilla = { error?: string; elegida?: string };

/**
 * Elige la plantilla de un evento.
 *
 * Guarda el snapshot de los colores en el evento, no sólo la referencia: si mañana se
 * corrige una plantilla del catálogo, los eventos ya configurados no cambian de aspecto
 * solos. Cambiar de plantilla vuelve a copiar el snapshot, que es lo que el fotógrafo
 * espera cuando toca otra opción.
 */
export async function elegirPlantillaAction(
  _previo: EstadoPlantilla,
  formData: FormData,
): Promise<EstadoPlantilla> {
  const eventoId = String(formData.get("eventoId") ?? "");
  const clave = String(formData.get("clave") ?? "");

  const almacen = await cookies();
  const token = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = token ? await getSessionUserByRawToken(token) : null;
  if (!usuario) return { error: "Tenés que iniciar sesión otra vez." };

  const plantilla = plantillaPorClave(clave);
  if (!plantilla) return { error: "Esa plantilla no existe." };

  // El filtro por dueño va en el update: un evento ajeno no se toca ni por error.
  const actualizados = await prisma.subilafotoEvent.updateMany({
    where: { id: eventoId, sellerProfile: { userId: usuario.id } },
    data: { themeTokens: plantilla.tokens },
  });

  if (actualizados.count === 0) return { error: "No encontramos ese evento." };

  revalidatePath(`/panel/eventos/${eventoId}/plantilla`);
  return { elegida: clave };
}
