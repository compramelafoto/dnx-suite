import "server-only";
import { prisma } from "@repo/db";
import { openingHasTime, type SocialVariant } from "@repo/muestras";
import { conPermiso } from "@/lib/equipo/permisos";
import type { Usuario } from "@/lib/usuario";

type Quien = Pick<Usuario, "id" | "esSuperAdmin">;

const SELECCION = {
  id: true, slug: true, title: true, type: true, reviewStatus: true, isCancelled: true, isVirtualOnly: true,
  startsAt: true, endsAt: true, openingAt: true, openingEndsAt: true, venueName: true, city: true, province: true,
  coverImageUrl: true, rsvpStatus: true,
  works: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, authorName: true, year: true, imageUrl: true, isHighlight: true } },
} as const;

/** Para armar las piezas (D25, D29): la muestra publicada, si la persona puede difundirla (`promote`). */
export function cargarMuestraParaRedes(id: string, usuario: Quien) {
  return prisma.culturalActivity.findFirst({
    where: conPermiso({ id, type: "MUESTRA", reviewStatus: "APPROVED" }, usuario, "promote"),
    select: SELECCION,
  });
}

/** Para la página de difusión de una muestra: también sin publicar (se ve el aviso). */
export function cargarMuestraParaDifusion(id: string, usuario: Quien) {
  return prisma.culturalActivity.findFirst({
    where: conPermiso({ id, type: "MUESTRA" }, usuario, "promote"),
    select: SELECCION,
  });
}

/** El listado de "Difusión": las que se pueden difundir, también las que todavía no se publicaron. */
export function listarMuestrasParaDifusion(usuario: Quien) {
  return prisma.culturalActivity.findMany({
    where: conPermiso({ type: "MUESTRA", reviewStatus: { in: ["APPROVED", "IN_REVIEW", "DRAFT"] } }, usuario, "promote", { listado: true }),
    select: {
      id: true, title: true, type: true, reviewStatus: true, isCancelled: true, isVirtualOnly: true,
      startsAt: true, endsAt: true, openingAt: true, openingEndsAt: true, venueName: true, city: true, province: true,
      _count: { select: { works: true } },
    },
    orderBy: { startsAt: "desc" },
  });
}

/** Por qué una pieza no está disponible ahora, en palabras de quien organiza. */
export function motivoNoDisponible(
  variante: SocialVariant,
  a: { isCancelled: boolean; isVirtualOnly: boolean; openingAt: Date | null },
): string {
  if (a.isCancelled) return "La muestra está cancelada: no se arman piezas.";
  switch (variante) {
    case "OPENING":
      return a.openingAt ? "Esta pieza ya no está disponible: la inauguración ya pasó." : "Cargá el día de la inauguración en la ficha para armar esta pieza.";
    case "INVITATION":
      if (a.isVirtualOnly) return "La invitación es para muestras presenciales.";
      return openingHasTime(a.openingAt) ? "Esta pieza ya no está disponible: la inauguración ya pasó." : "Cargá la hora de la inauguración en la ficha para armar la invitación.";
    case "LAST_DAYS":
      return "Esta pieza ya no está disponible: la muestra ya cerró.";
    case "WORK":
      return "La muestra todavía no tiene obras.";
  }
}
