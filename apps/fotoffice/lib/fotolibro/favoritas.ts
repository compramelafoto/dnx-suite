import "server-only";
import { prisma } from "@repo/db";
import { FAVORITAS_MAX, leerFavorita, type Favorita } from "./favoritas-tipos";

/**
 * Las distribuciones favoritas de cada persona. Se guardan en una plantilla propia, archivada (no
 * aparece en ninguna lista), con la clave `fotolibro-favoritas`: así no hace falta una tabla nueva
 * y valen en todos sus libros, del estudio o del portal del socio.
 */
const CLAVE = "fotolibro-favoritas";

async function plantillaDe(userId: number) {
  const candidatas = await prisma.templateV2.findMany({
    where: { ownerUserId: userId, workspaceId: null, status: "ARCHIVED" },
    select: { id: true, currentVersionId: true },
  });
  for (const t of candidatas) {
    if (!t.currentVersionId) continue;
    const v = await prisma.templateV2Version.findUnique({ where: { id: t.currentVersionId }, select: { id: true, metaJson: true } });
    const meta = (v?.metaJson ?? {}) as Record<string, unknown>;
    if (v && meta.templateKey === CLAVE) return { versionId: v.id, meta };
  }
  return null;
}

export async function leerFavoritas(userId: number): Promise<Favorita[]> {
  const p = await plantillaDe(userId);
  const lista = Array.isArray(p?.meta.favoritas) ? p.meta.favoritas : [];
  return lista.map(leerFavorita).filter((f): f is Favorita => f !== null);
}

export async function guardarFavoritas(userId: number, favoritas: Favorita[]): Promise<void> {
  const lista = favoritas.slice(0, FAVORITAS_MAX);
  const p = await plantillaDe(userId);
  if (p) {
    await prisma.templateV2Version.update({ where: { id: p.versionId }, data: { metaJson: { ...p.meta, favoritas: lista } } });
    return;
  }
  await prisma.$transaction(async (tx) => {
    const t = await tx.templateV2.create({
      data: { ownerUserId: userId, workspaceId: null, name: "Favoritas de fotolibro", status: "ARCHIVED" },
      select: { id: true },
    });
    const v = await tx.templateV2Version.create({
      data: {
        templateId: t.id,
        versionNumber: 1,
        canvasJson: { width: 1, height: 1 },
        metaJson: { templateKey: CLAVE, product: "fotoffice", favoritas: lista },
        createdByUserId: userId,
      },
      select: { id: true },
    });
    await tx.templateV2.update({ where: { id: t.id }, data: { currentVersionId: v.id } });
  });
}
