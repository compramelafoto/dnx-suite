"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { perfilDeVenta } from "@/lib/perfil-de-venta";
import { revisarPerfil } from "@/lib/perfil";

/**
 * Guarda la ficha de venta del fotógrafo.
 *
 * Hasta hoy no existía y el perfil nacía solo al crear el primer evento, con el nombre
 * "Mi estudio" y precio cero. Como la vitrina exige estar publicada y con precio, el
 * enlace de venta de cualquier fotógrafo daba 404 para siempre.
 */

export type EstadoDelPerfil = { error?: string; guardado?: boolean };

export async function guardarPerfilAction(
  _previo: EstadoDelPerfil,
  formData: FormData,
): Promise<EstadoDelPerfil> {
  const almacen = await cookies();
  const cookie = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = cookie ? await getSessionUserByRawToken(cookie) : null;
  if (!usuario) return { error: "Tenés que iniciar sesión otra vez." };

  const texto = (campo: string) => {
    const valor = formData.get(campo);
    return typeof valor === "string" ? valor : "";
  };

  const revision = revisarPerfil({
    displayName: texto("displayName"),
    precio: texto("precio"),
    headline: texto("headline"),
    descripcion: texto("descripcion"),
    logoUrl: texto("logoUrl"),
    brandColor: texto("brandColor"),
    termsText: texto("termsText"),
    publicar: formData.get("publicar") === "on",
  });

  if (!revision.ok) return { error: revision.error };

  // El perfil puede no existir todavía: se crea igual que al dar de alta el primer evento.
  const perfilId = await perfilDeVenta(usuario.id, usuario.name);

  /*
    El filtro por dueño va en el `updateMany` y no en un `if`: el identificador sale de la
    sesión, pero la condición en la escritura es lo que hace imposible tocar el perfil de
    otro aunque alguien cambie algo por el camino.
  */
  await prisma.subilafotoSellerProfile.updateMany({
    where: { id: perfilId, userId: usuario.id },
    data: revision.datos,
  });

  revalidatePath("/panel/perfil");
  revalidatePath("/panel");
  return { guardado: true };
}
