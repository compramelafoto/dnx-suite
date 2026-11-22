import "server-only";
import type { Prisma } from "@repo/db";
import { freeProfileSlug, profileSlugBase, type Discipline } from "@repo/muestras";
import type { PerfilForm } from "./mapear";

type Tx = Prisma.TransactionClient;

/**
 * El perfil propio dentro de una transacción, para quien se suma como expositor (etapa 6, D3).
 * Si la persona ya tiene perfil, no se pisa: sólo se completa la biografía si estaba vacía. Si no
 * tiene, se crea con el primer slug libre armado con su nombre y con `disciplinasSiCrea` (la
 * disciplina de la muestra a la que se suma). Las disciplinas de un perfil que ya existe no se tocan.
 *
 * Vive fuera de `acciones.ts` a propósito: un archivo `"use server"` expone cada función exportada
 * como acción, y ésta recibe el id de la cuenta como parámetro.
 */
export async function crearOActualizarPerfil(
  tx: Tx,
  userId: number,
  datos: Omit<PerfilForm, "slug" | "website" | "disciplines"> & { website?: string | null },
  disciplinasSiCrea: Discipline[],
): Promise<{ id: string; slug: string; creado: boolean }> {
  const actual = await tx.photographerProfile.findUnique({ where: { userId }, select: { id: true, slug: true, bio: true } });
  if (actual) {
    if (!actual.bio?.trim() && datos.bio) {
      await tx.photographerProfile.update({ where: { id: actual.id }, data: { bio: datos.bio } });
    }
    return { id: actual.id, slug: actual.slug, creado: false };
  }
  const base = profileSlugBase(datos.displayName);
  const parecidos = await tx.photographerProfile.findMany({ where: { slug: { startsWith: base.slice(0, 30) } }, select: { slug: true } });
  const slug = freeProfileSlug(base, new Set(parecidos.map((x) => x.slug)));
  const creado = await tx.photographerProfile.create({
    data: {
      userId, slug, displayName: datos.displayName, bio: datos.bio, city: datos.city, province: datos.province,
      website: datos.website ?? null, instagram: datos.instagram, avatarUrl: datos.avatarUrl,
      disciplines: disciplinasSiCrea,
    },
    select: { id: true, slug: true },
  });
  return { ...creado, creado: true };
}
