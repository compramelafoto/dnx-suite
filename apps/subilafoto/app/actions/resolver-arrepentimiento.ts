"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";

/**
 * Marca resuelta una solicitud de arrepentimiento.
 *
 * Es un acto con consecuencias legales, así que deja constancia de **quién** y **cuándo**,
 * y exige escribir qué se hizo. Un botón que sólo cambie un estado no sirve como registro:
 * dentro de seis meses lo que hace falta saber es qué se resolvió, no que alguien apretó.
 */

export type EstadoDeResolucion = { error?: string; resuelta?: string };

export async function resolverArrepentimientoAction(
  _previo: EstadoDeResolucion,
  formData: FormData,
): Promise<EstadoDeResolucion> {
  const almacen = await cookies();
  const cookie = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = cookie ? await getSessionUserByRawToken(cookie) : null;
  if (!usuario) return { error: "Tenés que iniciar sesión otra vez." };

  const fila = await prisma.user.findUnique({
    where: { id: usuario.id },
    select: { globalRole: true },
  });
  if (fila?.globalRole !== "SUPER_ADMIN" && fila?.globalRole !== "PLATFORM_SUPPORT") {
    return { error: "Hace falta un usuario administrador." };
  }

  const id = String(formData.get("id") ?? "");
  const orderId = String(formData.get("orderId") ?? "").trim() || null;
  const resolucion = String(formData.get("resolucion") ?? "").trim();

  if (resolucion.length < 5) {
    return { error: "Escribí qué se hizo: es lo que queda como registro." };
  }

  /*
    La condición `status: RECEIVED` va en el `where`. Si dos personas la resuelven a la
    vez, la segunda cambia cero filas en vez de pisar lo que escribió la primera — y lo
    que se pisaría es el registro de una obligación legal.
  */
  const cambio = await prisma.subilafotoRetractionRequest.updateMany({
    where: { id, status: "RECEIVED" },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      orderId,
      resolution: `${resolucion.slice(0, 2000)}\n— ${usuario.email}`,
    },
  });

  if (cambio.count === 0) {
    return { error: "Esa solicitud ya estaba resuelta. Actualizá la pantalla." };
  }

  revalidatePath("/panel/arrepentimientos");
  return { resuelta: id };
}
