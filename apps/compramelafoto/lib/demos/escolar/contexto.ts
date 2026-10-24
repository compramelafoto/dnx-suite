import { prisma } from "@/lib/prisma";
import { DEMO_ESCOLAR } from "@/lib/demos/escolar/datos";
import type { CtxGuion } from "@/lib/demos/guiones/tipos";

/** Ids de lo sembrado por «Preparar». `null` si la demo todavía no se preparó. */
export async function getContextoDemoEscolar(): Promise<
  (CtxGuion & { fotografoId: number; colegioUserId: number }) | null
> {
  const [fotografo, colegio, album] = await Promise.all([
    prisma.user.findUnique({ where: { email: DEMO_ESCOLAR.fotografo.email }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: DEMO_ESCOLAR.colegioUsuario.email }, select: { id: true } }),
    prisma.album.findFirst({
      where: { publicSlug: DEMO_ESCOLAR.album.slug },
      select: { id: true, publicSlug: true, schoolId: true },
    }),
  ]);
  if (!fotografo || !colegio || !album?.schoolId) return null;
  return {
    fotografoId: fotografo.id,
    colegioUserId: colegio.id,
    albumId: album.id,
    albumSlug: album.publicSlug,
    schoolId: album.schoolId,
    handler: DEMO_ESCOLAR.fotografo.handler,
  };
}
