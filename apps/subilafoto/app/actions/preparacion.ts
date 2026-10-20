"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { eventoQueAdministra } from "@/lib/acceso-al-evento";
import { esPuntoDelSalon } from "@/lib/preparacion";

export type EstadoPreparacion = { error?: string };

/**
 * Confirma —o desconfirma— uno de los puntos del salón.
 *
 * Guarda la fecha y no un sí: una confirmación sobre el salón hecha hace tres semanas
 * vale menos que una de ayer, y con la fecha a la vista se puede decidir si hay que
 * volver a preguntar.
 */
export async function confirmarPuntoAction(
  _previo: EstadoPreparacion,
  formData: FormData,
): Promise<EstadoPreparacion> {
  const eventoId = String(formData.get("eventoId") ?? "");
  const clave = String(formData.get("clave") ?? "");
  const confirmar = String(formData.get("confirmar") ?? "") === "1";

  const almacen = await cookies();
  const token = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = token ? await getSessionUserByRawToken(token) : null;
  if (!usuario) return { error: "Tenés que iniciar sesión otra vez." };

  // Nada de lo que manda el navegador entra crudo en lo que se guarda.
  if (!esPuntoDelSalon(clave)) return { error: "Ese punto no existe." };

  const evento = await prisma.subilafotoEvent.findFirst({
    where: eventoQueAdministra(eventoId, usuario.id),
    select: { id: true, preparacion: true },
  });
  if (!evento) return { error: "No encontramos ese evento." };

  /*
    Se reescribe el objeto entero filtrando por las claves conocidas. Si alguna vez quedó
    guardada una clave que ya no existe —se renombró un punto, se probó algo— esto la
    limpia en vez de arrastrarla para siempre.
  */
  const previo = (evento.preparacion ?? {}) as Record<string, unknown>;
  const limpio: Record<string, string> = {};
  for (const [k, v] of Object.entries(previo)) {
    if (esPuntoDelSalon(k) && typeof v === "string") limpio[k] = v;
  }

  if (confirmar) limpio[clave] = new Date().toISOString();
  else delete limpio[clave];

  await prisma.subilafotoEvent.update({
    where: { id: evento.id },
    data: { preparacion: limpio },
  });

  revalidatePath(`/panel/eventos/${eventoId}`);
  return {};
}
