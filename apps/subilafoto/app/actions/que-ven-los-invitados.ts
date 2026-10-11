"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { eventoQueAdministra } from "@/lib/acceso-al-evento";

export type EstadoQueVen = { error?: string };

/** Los dos únicos interruptores que se pueden tocar desde acá. */
const PERMITIDOS = new Set(["guestsCanSeeAlbum", "guestsCanSeeLive"]);

/**
 * Enciende o apaga lo que ven los invitados.
 *
 * Los dos campos existían en la base desde el principio y **no había ninguna pantalla
 * para cambiarlos**: el álbum se apagó a mano con SQL el 9/10/2026. Un interruptor que
 * sólo se puede tocar con una consulta no es un interruptor.
 */
export async function cambiarQueVenAction(
  _previo: EstadoQueVen,
  formData: FormData,
): Promise<EstadoQueVen> {
  const eventoId = String(formData.get("eventoId") ?? "");
  const campo = String(formData.get("campo") ?? "");
  const encender = String(formData.get("encender") ?? "") === "1";

  const almacen = await cookies();
  const token = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = token ? await getSessionUserByRawToken(token) : null;
  if (!usuario) return { error: "Tenés que iniciar sesión otra vez." };

  // Lista cerrada: el nombre del campo viene del navegador y termina en un `update`.
  if (!PERMITIDOS.has(campo)) return { error: "Ese interruptor no existe." };

  const actualizados = await prisma.subilafotoEvent.updateMany({
    where: eventoQueAdministra(eventoId, usuario.id),
    data: { [campo]: encender },
  });
  if (actualizados.count === 0) return { error: "No encontramos ese evento." };

  revalidatePath(`/panel/eventos/${eventoId}`);
  return {};
}
