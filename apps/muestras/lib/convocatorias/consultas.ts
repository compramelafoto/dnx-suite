import "server-only";
import { cache } from "react";
import { prisma } from "@repo/db";
import { hasPhysicalVenue } from "@repo/muestras";
import { dondePuede, puedeConDueno } from "@/lib/equipo/permisos";
import type { Usuario } from "@/lib/usuario";

/** Datos de la muestra que se muestran junto a la convocatoria (nada de revisión). */
const MUESTRA_PUBLICA = {
  select: { title: true, slug: true, reviewStatus: true, coverImageUrl: true, venueName: true, address: true, city: true, province: true, isVirtualOnly: true, startsAt: true, endsAt: true },
} as const;

/**
 * Abiertas (recibiendo o por recibir) de muestras presenciales. El filtro fino por fecha lo hace
 * `callPhase`; el del lugar, `hasPhysicalVenue` en la página.
 */
export function listarConvocatoriasPublicas() {
  return prisma.culturalCall.findMany({
    where: { status: "OPEN", activity: { reviewStatus: "APPROVED", isVirtualOnly: false } },
    select: { id: true, slug: true, title: true, status: true, opensAt: true, closesAt: true, maxWorksPerPerson: true, activity: MUESTRA_PUBLICA },
    orderBy: { closesAt: "asc" },
    take: 200,
  });
}

/**
 * Cualquiera que no sea borrador: un enlace compartido no se rompe al cerrar. Si la muestra dejó
 * de tener un lugar físico (`hasPhysicalVenue`), la convocatoria deja de ser pública: devuelve
 * `null`, igual que si no existiera.
 */
export const buscarConvocatoriaPublica = cache(async (slug: string) => {
  const c = await prisma.culturalCall.findFirst({
    where: { slug, status: { not: "DRAFT" }, activity: { reviewStatus: "APPROVED" } },
    select: {
      id: true, slug: true, title: true, status: true, basesText: true, requirementsText: true, rightsText: true,
      opensAt: true, closesAt: true, maxWorksPerPerson: true, activity: MUESTRA_PUBLICA,
    },
  });
  return c && hasPhysicalVenue(c.activity) ? c : null;
});

/**
 * Las convocatorias que organiza la persona (todas, si es super admin: modera). Convocatoria y
 * curaduría son sólo del dueño (`manageCall`, etapa 5 D4): la coorganización no las ve.
 */
export function listarConvocatoriasMias(usuario: Usuario) {
  return prisma.culturalCall.findMany({
    where: usuario.esSuperAdmin ? {} : { activity: dondePuede(usuario, "manageCall") },
    select: {
      id: true, title: true, status: true, opensAt: true, closesAt: true,
      activity: { select: { title: true } },
      _count: { select: { submissions: { where: { status: "ACTIVE" } }, curators: { where: { status: "ACTIVE" } } } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

/** Muestras propias (`manageCall`) que todavía no tienen convocatoria. */
export function muestrasSinConvocatoria(usuario: Pick<Usuario, "id" | "esSuperAdmin">) {
  return prisma.culturalActivity.findMany({
    where: { type: "MUESTRA", call: null, reviewStatus: { not: "UNPUBLISHED" }, ...dondePuede(usuario, "manageCall", { listado: true }) },
    select: { id: true, title: true, reviewStatus: true },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Una convocatoria para su organizador (o el super admin). Sin identidades: sólo cuentas.
 * `null` si no existe o no es suya.
 */
export async function buscarConvocatoriaDelOrganizador(id: string, usuario: Usuario) {
  const c = await prisma.culturalCall.findUnique({
    where: { id },
    include: {
      activity: { select: { id: true, title: true, slug: true, reviewStatus: true, proposedByUserId: true, _count: { select: { works: true } } } },
      curators: { select: { id: true, email: true, status: true, invitedAt: true, acceptedAt: true }, orderBy: { invitedAt: "asc" } },
      _count: { select: { submissions: { where: { status: "ACTIVE" } } } },
    },
  });
  if (!c) return null;
  if (!puedeConDueno(usuario, "manageCall", c.activity.proposedByUserId)) return null;
  const obras = await prisma.culturalCallWork.count({ where: { callId: id, submission: { status: "ACTIVE" } } });
  return { ...c, obras };
}
