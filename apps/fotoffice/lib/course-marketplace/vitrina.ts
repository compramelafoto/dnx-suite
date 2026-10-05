// lib/course-marketplace/vitrina.ts
import "server-only";
import { prisma } from "@repo/db";
import { getAuthUser } from "@/lib/auth";

/**
 * Los cursos de otros negocios en el sitio y el portal de quien los revende (spec, sección 4.3):
 * aparecen con su marca, igual que los propios. Sólo con un acuerdo ACTIVO y el curso publicado.
 */

export type AcuerdoDeVitrina = { id: string; courseId: string; shareBps: number; memberDiscountBps: number };

/**
 * El acuerdo por el que `workspaceId` muestra en `/cursos/{courseSlug}` un curso ajeno. Se busca
 * sólo si el negocio no tiene un curso propio con ese slug: el propio siempre gana. Entre dos
 * revendidos con el mismo slug, el acuerdo más viejo.
 */
export async function buscarAcuerdoDeVitrina(workspaceId: string, courseSlug: string): Promise<AcuerdoDeVitrina | null> {
  return prisma.courseResaleAgreement.findFirst({
    where: {
      resellerWorkspaceId: workspaceId,
      status: "ACTIVO",
      course: { slug: courseSlug, status: "PUBLISHED", deliveryMode: "RECORDED" },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, courseId: true, shareBps: true, memberDiscountBps: true },
  });
}

export async function cursosRevendidosDe(workspaceId: string) {
  return prisma.courseResaleAgreement.findMany({
    where: { resellerWorkspaceId: workspaceId, status: "ACTIVO", course: { status: "PUBLISHED", deliveryMode: "RECORDED" } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      shareBps: true,
      memberDiscountBps: true,
      course: {
        select: { id: true, slug: true, title: true, shortDescription: true, coverImageUrl: true, thumbnailImageUrl: true, priceArs: true, workspaceId: true },
      },
    },
  });
}

/**
 * ¿Quien está mirando es socio activo de este negocio? Sale de la sesión: el descuento nunca se
 * pide desde el navegador. Sin sesión (o en un dominio propio, donde la sesión de FOTOFFICE no
 * viaja), no es socio: paga el precio público.
 */
export async function esSocioActivoDe(workspaceId: string): Promise<boolean> {
  const user = await getAuthUser();
  if (!user) return false;
  const ficha = await prisma.member.findFirst({ where: { userId: user.id, workspaceId, status: "ACTIVE" }, select: { id: true } });
  return ficha !== null;
}
