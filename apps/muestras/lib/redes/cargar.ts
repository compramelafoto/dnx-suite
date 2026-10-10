import "server-only";
import { prisma } from "@repo/db";
import { openingHasTime, visibleWorks, type SocialVariant } from "@repo/muestras";
import { conPermiso } from "@/lib/equipo/permisos";
import type { Usuario } from "@/lib/usuario";

type Quien = Pick<Usuario, "id" | "esSuperAdmin">;

const SELECCION = {
  id: true, slug: true, title: true, type: true, reviewStatus: true, isCancelled: true, isVirtualOnly: true,
  startsAt: true, endsAt: true, openingAt: true, openingEndsAt: true, venueName: true, city: true, province: true,
  coverImageUrl: true, rsvpStatus: true, galleryMode: true, visibility: true,
  works: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, authorName: true, year: true, imageUrl: true, isHighlight: true, sortOrder: true } },
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
      galleryMode: true, visibility: true,
      works: { select: { id: true, isHighlight: true, sortOrder: true } },
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

/**
 * Las obras que una pieza para redes puede difundir hoy (spec D25, D39): sólo las que se ven online
 * según la sorpresa. "Sorpresa total" → ninguna; "cambian para cada visitante" → ninguna (no hay un
 * conjunto fijo: difundir una sería adelantar una obra que la publicación no muestra).
 */
export function obrasParaDifundir<W extends { id: string; isHighlight: boolean; sortOrder: number }>(
  a: { galleryMode: string; visibility: unknown; startsAt: Date; endsAt: Date; works: W[] },
  ahora: Date,
): W[] {
  return visibleWorks(a, a.works, ahora).works;
}

/** Por qué no hay "Obra destacada" aunque la muestra tenga obras: la sorpresa no deja ver ninguna online. */
export function motivoSinObrasOnline(a: { galleryMode: string; visibility: unknown; startsAt: Date; endsAt: Date; works: { id: string; isHighlight: boolean; sortOrder: number }[] }, ahora: Date): string | null {
  if (a.works.length === 0) return null;
  const g = visibleWorks(a, a.works, ahora);
  if (g.perVisit) return "Online cada visitante ve otras obras: con este ajuste no se difunden obras de la sala. Usá 'Inaugura' o 'Últimos días'.";
  if (g.works.length === 0) return "Con 'Sorpresa total' no se difunden obras de la sala: usá 'Inaugura' o 'Invitación'.";
  return null;
}
