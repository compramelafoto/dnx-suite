import "server-only";
import { prisma } from "@repo/db";
import { exhibitorLinkState, temporalStatus } from "@repo/muestras";
import { conPermiso } from "@/lib/equipo/permisos";
import { baseUrlPublica } from "@/lib/fichas/cargar";
import type { Usuario } from "@/lib/usuario";

type Quien = Pick<Usuario, "id" | "esSuperAdmin">;

/**
 * El enlace de expositores de una muestra para quien tiene `exhibitors` (dueño, coorganización o
 * super admin). `null` si no existe o no puede: la página responde 404.
 */
export async function enlaceDeExpositores(activityId: string, usuario: Quien) {
  const a = await prisma.culturalActivity.findFirst({
    where: conPermiso({ id: activityId, type: "MUESTRA" }, usuario, "exhibitors"),
    select: {
      id: true, slug: true, title: true, type: true, reviewStatus: true, isCancelled: true, startsAt: true, endsAt: true,
      galleryMode: true, visibility: true,
      exhibitorLink: {
        select: { token: true, status: true, closesAt: true, maxWorksPerExhibitor: true, maxExhibitors: true, instructions: true, rotatedAt: true },
      },
      _count: { select: { exhibitors: { where: { status: "ACTIVE" } } } },
    },
  });
  if (!a) return null;
  const { exhibitorLink: enlace, _count, visibility, ...muestra } = a;
  const ahora = new Date();
  return {
    cerrada: temporalStatus(a, ahora) === "CLOSED",
    muestra,
    tieneAjuste: visibility != null,
    enlace,
    estado: exhibitorLinkState(enlace, a, ahora),
    url: enlace ? `${baseUrlPublica()}/expositores/${enlace.token}` : null,
    expositores: _count.exhibitors,
  };
}
