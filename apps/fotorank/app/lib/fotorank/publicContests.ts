import { prisma } from "@repo/db";
import {
  getClickatonReadonlyClient,
  isClickatonReadonlyAvailable,
} from "@repo/db/clickaton-readonly-client";
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
  /**
   * Formato de la convocatoria, para que el participante distinga de un vistazo
   * un concurso de una maratón. Se resuelve en esta capa —no en el componente—
   * porque `public-ui` debe permanecer neutro respecto de otros productos.
   */
  modalityLabel: "Concurso fotográfico" | "Maratón fotográfica";
  /** Destino del enlace. Puede apuntar fuera de FotoRank. */
  href: string;
  /** true cuando el destino vive en otro dominio y conviene abrirlo aparte. */
  isExternal: boolean;
};

/**
 * Estado público de una convocatoria, según la VENTANA DE INSCRIPCIÓN.
 *
 * La etiqueta responde una sola pregunta: ¿se puede anotar hoy?
 *
 *   Próximamente          la inscripción todavía no abrió
 *   Inscripciones abiertas se puede anotar ahora
 *   Cerrado                la inscripción ya cerró (se oculta de la home)
 *
 * Antes esto miraba `startAt`, la fecha en que ocurre el evento, y por eso una
 * maratón con inscripción abierta pero fecha futura aparecía como
 * "Próximamente" — decía que no te podías anotar cuando sí podías. Para un
 * concurso la diferencia rara vez se nota; para una maratón, que se inscribe
 * semanas antes del día del evento, es un error visible.
 *
 * Exportada para poder testear el filtrado público sin depender de la DB.
 */
export function getStatusLabel(
  now: Date,
  registrationOpensAt: Date | null,
  registrationClosesAt: Date | null,
): PublicHomeContestCard["statusLabel"] {
  if (registrationClosesAt && registrationClosesAt.getTime() < now.getTime()) return "Cerrado";
  if (registrationOpensAt && registrationOpensAt.getTime() > now.getTime()) return "Próximamente";
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
  /** Apertura de inscripción. Si falta, se cae a `startAt` como referencia. */
  registrationOpensAt?: Date | null;
  registrationClosesAt: Date | null;
  submissionDeadline: Date | null;
  startAt: Date | null;
  categoriesCount: number;
  now: Date;
  /** CONTEST por defecto: una fila sin dato explícito no se convierte en maratón. */
  experienceType?: "CONTEST" | "MARATHON" | null;
  /** Sólo para convocatorias que viven fuera de FotoRank. */
  href?: string;
}): PublicHomeContestCard {
  const theme = resolveContestVisualTheme(input.slug, undefined, {
    coverImageUrl: input.coverImageUrl,
    contestTitle: input.title,
    organizerName: input.organizerName,
  });
  const hero = resolveHeroAsset(theme.presentation, "desktop");
  const isMarathon = input.experienceType === "MARATHON";

  return {
    slug: input.slug,
    title: input.title,
    organizerName: input.organizerName,
    coverImageUrl: input.coverImageUrl,
    submissionDeadline: input.submissionDeadline,
    startAt: input.startAt,
    categoriesCount: input.categoriesCount,
    /**
     * Ventana de inscripción, no fechas del evento. `startAt` sólo se usa como
     * respaldo cuando la convocatoria no declara cuándo abre la inscripción:
     * en ese caso, la fecha de comienzo es la mejor referencia disponible.
     */
    statusLabel: getStatusLabel(
      input.now,
      input.registrationOpensAt ?? input.startAt,
      input.registrationClosesAt ?? input.submissionDeadline,
    ),
    heroImageUrl: hero?.url ?? null,
    // El alt del manifiesto es curado; el fallback nombra el concurso, nunca "imagen".
    heroImageAlt: hero?.alt?.trim() || `Imagen de ${input.title}`,
    registrationCloseLabel: resolveRegistrationCloseLabel({
      slug: input.slug,
      registrationClosesAt: input.registrationClosesAt,
      submissionDeadline: input.submissionDeadline,
    }),
    modalityLabel: isMarathon ? "Maratón fotográfica" : "Concurso fotográfico",
    href: input.href ?? `/concursos/${input.slug}`,
    isExternal: Boolean(input.href),
  };
}

/**
 * Ordena por urgencia: primero lo que cierra antes. Las convocatorias sin fecha
 * de cierre van al final, porque no compiten por atención inmediata.
 */
/**
 * Une ambos orígenes evitando que una misma convocatoria aparezca dos veces.
 *
 * Gana siempre la publicada en FotoRank: si existe acá, tiene bases,
 * categorías e inscripción propias, y su enlace es interno.
 */
export function dedupeBySlug(
  preferred: PublicHomeContestCard[],
  extra: PublicHomeContestCard[],
): PublicHomeContestCard[] {
  const seen = new Set(preferred.map((c) => c.slug));
  return [...preferred, ...extra.filter((c) => !seen.has(c.slug))];
}

export function sortHomeCards(cards: PublicHomeContestCard[]): PublicHomeContestCard[] {
  return [...cards].sort((a, b) => {
    const at = a.submissionDeadline?.getTime() ?? Number.POSITIVE_INFINITY;
    const bt = b.submissionDeadline?.getTime() ?? Number.POSITIVE_INFINITY;
    if (at !== bt) return at - bt;
    return a.title.localeCompare(b.title, "es");
  });
}

/**
 * Base pública del sitio de maratones, para enlazar las convocatorias externas.
 * Se lee del entorno; el valor por defecto es el productivo.
 */
function marathonSiteBaseUrl(): string {
  const raw = process.env.CLICKATON_PUBLIC_WEB_BASE_URL?.trim();
  return (raw || "https://maratonfotografica.com").replace(/\/+$/, "");
}

/** Estados de una edición que corresponden a una convocatoria vigente. */
const OPEN_EDITION_STATUSES = ["REGISTRATION_OPEN", "REGISTRATION_CLOSED"] as const;

/**
 * Nombres que delatan una edición de prueba.
 *
 * El otro producto declara la regla en su capa pública ("No copy TEST en
 * superficies públicas"), pero no siempre viaja en `isOpsFixture`: hay
 * ediciones publicadas y con inscripción cuyo único indicio está en el nombre.
 * Sin esta red, la home publicaría "Clickatón AR2026 — TEST UX".
 *
 * Se usa `\b` para no ocultar convocatorias legítimas que contengan estas
 * subcadenas ("Protesta", "Detalles", "Contestación").
 */
const TEST_EDITION_NAME = /\b(test|testing|piloto|pilot|demo|qa|staging|prueba|fixture|sandbox)\b/i;

/** Exportada para poder probarla sin base. */
export function looksLikeTestEdition(name: string, slug: string): boolean {
  return TEST_EDITION_NAME.test(name) || TEST_EDITION_NAME.test(slug.replace(/-/g, " "));
}

/**
 * Convocatorias de maratón, leídas de la base del otro producto.
 *
 * En producción cada aplicación usa su propia base aunque compartan el
 * `schema.prisma`, así que esto NO puede resolverse con el cliente habitual de
 * FotoRank: iría a la base equivocada. Se usa una conexión dedicada de solo
 * lectura (`CLICKATON_READONLY_DATABASE_URL`).
 *
 * Si esa conexión no está configurada, la función devuelve una lista vacía y la
 * home sigue mostrando los concursos: la integración es opcional por diseño.
 */
async function listPublicMarathonEditions(now: Date, limit: number): Promise<PublicHomeContestCard[]> {
  if (!isClickatonReadonlyAvailable()) return [];

  const client = getClickatonReadonlyClient();
  const editions = await client.clickatonEdition.findMany({
    where: {
      isPublished: true,
      isOpsFixture: false,
      registrationEnabled: true,
      status: { in: [...OPEN_EDITION_STATUSES] },
    },
    select: {
      slug: true,
      name: true,
      city: true,
      provinceOrState: true,
      coverImageUrl: true,
      startAt: true,
      registrationOpenAt: true,
      registrationCloseAt: true,
    },
    orderBy: [{ registrationCloseAt: "asc" }, { startAt: "asc" }],
    take: limit * 2,
  });

  return editions
    .filter((e) => !looksLikeTestEdition(e.name, e.slug))
    .map((e) =>
      toPublicHomeContestCard({
        slug: e.slug,
        title: e.name,
        // El modelo no tiene organización propia: se ubica por sede.
        organizerName: [e.city, e.provinceOrState].filter(Boolean).join(", ") || "Maratón fotográfica",
        coverImageUrl: e.coverImageUrl,
        registrationOpensAt: e.registrationOpenAt,
        registrationClosesAt: e.registrationCloseAt,
        submissionDeadline: e.registrationCloseAt,
        startAt: e.startAt,
        categoriesCount: 0,
        now,
        experienceType: "MARATHON",
        href: `${marathonSiteBaseUrl()}/maratones/${e.slug}`,
      }),
    );
}

/**
 * Convocatorias públicas de la home: concursos y maratones en una sola lista.
 *
 * Dos orígenes, una sola tarjeta:
 *  - `FotorankContest`, donde una maratón es un concurso con
 *    `experienceType = MARATHON` publicado desde el panel;
 *  - las ediciones del otro producto, por conexión de solo lectura.
 *
 * Se deduplica por slug dando prioridad a lo publicado en FotoRank: si una
 * edición ya tiene su convocatoria acá, la de FotoRank manda —tiene bases,
 * categorías e inscripción propias—.
 *
 * Si la lectura de maratones falla o no está configurada, los concursos se
 * muestran igual: un problema en un producto no puede vaciar la home del otro.
 */
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

    const fromContests = contests.map((c) =>
      toPublicHomeContestCard({
        slug: c.slug,
        title: c.title,
        organizerName: c.organization.name,
        coverImageUrl: c.coverImageUrl,
        registrationOpensAt: c.registrationOpensAt,
        registrationClosesAt: c.registrationClosesAt,
        submissionDeadline: c.submissionDeadline,
        startAt: c.startAt,
        categoriesCount: c.categories.length,
        now,
        // Una maratón publicada como concurso de FotoRank ya trae este dato.
        experienceType: c.experienceType,
      }),
    );

    const fromMarathons = await listPublicMarathonEditions(now, limit).catch(() => []);

    return sortHomeCards(dedupeBySlug(fromContests, fromMarathons))
      .filter((c) => c.statusLabel !== "Cerrado")
      .slice(0, limit);
  } catch {
    // Home pública: degradar a lista vacía si no hay DB (preview / build local).
    return [];
  }
}
