import { prisma } from "@repo/db";
import { resolveRegistrationCloseLabel } from "./contest-public-presentation";
import { resolveContestVisualTheme, resolveHeroAsset } from "./contest-visual";

export type PublicHomeContestCard = {
  slug: string;
  title: string;
  organizerName: string;
  coverImageUrl: string | null;
  submissionDeadline: Date | null;
  startAt: Date | null;
  categoriesCount: number;
  statusLabel: "Inscripciones abiertas" | "Próximamente" | "Cerrado";
  /**
   * Imagen ya resuelta para la tarjeta, con la misma precedencia que la landing
   * (asset curado del manifiesto → portada configurada → ninguna). `null`
   * significa que el concurso no tiene imagen y la tarjeta usa el fallback
   * tipográfico; no es un error.
   */
  heroImageUrl: string | null;
  heroImageAlt: string;
  /** Etiqueta pública de cierre, idéntica a la que muestra la landing. */
  registrationCloseLabel: string | null;
};

/** Exportada para poder testear el filtrado público de la home sin depender de la DB. */
export function getStatusLabel(now: Date, startAt: Date | null, deadline: Date | null): PublicHomeContestCard["statusLabel"] {
  if (deadline && deadline.getTime() < now.getTime()) return "Cerrado";
  if (startAt && startAt.getTime() > now.getTime()) return "Próximamente";
  return "Inscripciones abiertas";
}

/**
 * Resuelve la presentación de una tarjeta del home a partir de datos crudos.
 *
 * Vive separada del acceso a base para poder probar la precedencia de imagen y
 * la etiqueta de cierre sin DB. Reutiliza `resolveContestVisualTheme`, que es
 * el mismo resolvedor que usa la landing: el manifiesto curado del concurso
 * gana sobre `coverImageUrl`, y si no hay ninguno queda `null`. Así el
 * componente visual no necesita conocer ningún concurso en particular.
 */
export function toPublicHomeContestCard(input: {
  slug: string;
  title: string;
  organizerName: string;
  coverImageUrl: string | null;
  registrationClosesAt: Date | null;
  submissionDeadline: Date | null;
  startAt: Date | null;
  categoriesCount: number;
  now: Date;
}): PublicHomeContestCard {
  const theme = resolveContestVisualTheme(input.slug, undefined, {
    coverImageUrl: input.coverImageUrl,
    contestTitle: input.title,
    organizerName: input.organizerName,
  });
  const hero = resolveHeroAsset(theme.presentation, "desktop");

  return {
    slug: input.slug,
    title: input.title,
    organizerName: input.organizerName,
    coverImageUrl: input.coverImageUrl,
    submissionDeadline: input.submissionDeadline,
    startAt: input.startAt,
    categoriesCount: input.categoriesCount,
    statusLabel: getStatusLabel(input.now, input.startAt, input.submissionDeadline),
    heroImageUrl: hero?.url ?? null,
    // El alt del manifiesto es curado; el fallback nombra el concurso, nunca "imagen".
    heroImageAlt: hero?.alt?.trim() || `Imagen de ${input.title}`,
    registrationCloseLabel: resolveRegistrationCloseLabel({
      slug: input.slug,
      registrationClosesAt: input.registrationClosesAt,
      submissionDeadline: input.submissionDeadline,
    }),
  };
}

export async function listPublicHomeContests(limit = 6): Promise<PublicHomeContestCard[]> {
  try {
    const now = new Date();
    const contests = await prisma.fotorankContest.findMany({
      where: {
        visibility: "PUBLIC",
        status: { in: ["PUBLISHED", "ACTIVE"] },
      },
      include: {
        organization: { select: { name: true } },
        categories: { where: { status: "ACTIVE" }, select: { id: true } },
      },
      orderBy: [{ submissionDeadline: "asc" }, { createdAt: "desc" }],
      take: limit * 2,
    });

    return contests
      .map((c) =>
        toPublicHomeContestCard({
          slug: c.slug,
          title: c.title,
          organizerName: c.organization.name,
          coverImageUrl: c.coverImageUrl,
          registrationClosesAt: c.registrationClosesAt,
          submissionDeadline: c.submissionDeadline,
          startAt: c.startAt,
          categoriesCount: c.categories.length,
          now,
        }),
      )
      .filter((c) => c.statusLabel !== "Cerrado")
      .slice(0, limit);
  } catch {
    // Home pública: degradar a lista vacía si no hay DB (preview / build local).
    return [];
  }
}
