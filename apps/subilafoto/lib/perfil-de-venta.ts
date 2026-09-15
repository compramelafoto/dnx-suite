import "server-only";

import { prisma } from "@repo/db";

/**
 * Vive acá y no en un archivo de acciones porque en un `"use server"` **todo lo que se
 * exporta es invocable desde el navegador**. Esto no tiene por qué serlo.
 */

/** Perfil de venta del usuario. Si todavía no tiene, se crea uno mínimo que después edita. */
export async function perfilDeVenta(userId: number, nombreUsuario: string | null) {
  const existente = await prisma.subilafotoSellerProfile.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (existente) return existente.id;

  const base = (nombreUsuario ?? "profesional")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "profesional";

  // El slug es público y único: si está tomado, se le agrega un sufijo corto.
  for (let intento = 0; intento < 5; intento++) {
    const slug = intento === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const creado = await prisma.subilafotoSellerProfile.create({
        data: {
          userId,
          slug,
          displayName: nombreUsuario ?? "Mi estudio",
          basePriceCents: 0,
          isPublished: false,
        },
        select: { id: true },
      });
      return creado.id;
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  }
  throw new Error("No se pudo crear el perfil de venta.");
}
