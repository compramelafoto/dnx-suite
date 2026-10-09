"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { esClaveDePortada } from "@/lib/portada";

export type EstadoPortada = { error?: string; guardado?: boolean };

/** Lo que entra en "¿de quién es la fiesta?". Un nombre, no una biografía. */
const LARGO_MAXIMO_ANFITRIONES = 80;

/**
 * Guarda la portada del evento y de quién es la fiesta.
 *
 * Son los dos datos que el invitado ve primero al escanear el QR: la foto de la
 * quinceañera y su nombre. Hasta el 2026-10-09 los dos campos existían en la base y los
 * leía la puerta, pero no había forma de cargarlos.
 */
export async function guardarPortadaAction(
  _previo: EstadoPortada,
  formData: FormData,
): Promise<EstadoPortada> {
  const eventoId = String(formData.get("eventoId") ?? "");
  const anfitriones = String(formData.get("anfitriones") ?? "").trim();
  const clave = String(formData.get("clave") ?? "").trim();
  const quitarPortada = formData.get("quitarPortada") === "1";

  const almacen = await cookies();
  const token = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = token ? await getSessionUserByRawToken(token) : null;
  if (!usuario) return { error: "Tenés que iniciar sesión otra vez." };

  if (anfitriones.length > LARGO_MAXIMO_ANFITRIONES) {
    return { error: `El nombre no puede pasar de ${LARGO_MAXIMO_ANFITRIONES} caracteres.` };
  }

  /*
    La clave tiene que ser una de las nuestras. El navegador manda lo que le devolvió la
    ruta de subida, pero nada impide que mande otra cosa: sin esta comprobación, alguien
    podría apuntar la portada a la clave de un archivo de otro evento.
  */
  if (clave && !esClaveDePortada(clave)) {
    return { error: "Esa imagen no se subió desde acá. Probá de nuevo." };
  }

  const datos: { hostsLabel: string | null; coverUrl?: string | null } = {
    hostsLabel: anfitriones || null,
  };
  if (quitarPortada) datos.coverUrl = null;
  else if (clave) datos.coverUrl = clave;

  // El filtro por dueño va en el update: un evento ajeno no se toca ni por error.
  const actualizados = await prisma.subilafotoEvent.updateMany({
    where: { id: eventoId, sellerProfile: { userId: usuario.id } },
    data: datos,
  });

  if (actualizados.count === 0) return { error: "No encontramos ese evento." };

  revalidatePath(`/panel/eventos/${eventoId}/portada`);
  return { guardado: true };
}
