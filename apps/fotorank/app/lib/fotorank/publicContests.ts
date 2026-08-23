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
    statusLabel: getStatusLabel(input.now, input.startAt, input.submissionDeadline),
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
 * Base pública del sitio de maratones. Se lee del entorno para no fijar el
 * dominio en el código; el valor por defecto es el productivo.
 */
function marathonSiteBaseUrl(): string {
  const raw = process.env.CLICKATON_PUBLIC_WEB_BASE_URL?.trim();
  return (raw || "https://maratonfotografica.com").replace(/\/+$/, "");
}

/**
 * Estados de una edición externa que corresponden a una convocatoria vigente.
 * El resto (borrador, en curso, finalizada, cancelada) no se publica en la home.
 */
const OPEN_EDITION_STATUSES = ["REGISTRATION_OPEN", "REGISTRATION_CLOSED"] as const;

/**
 * Convocatorias de maratón gestionadas fuera de FotoRank.
 *
 * Ambos productos comparten la misma base y el mismo cliente Prisma, así que se
 * leen directamente; no hay API de listado que consumir. Se excluyen las
 * ediciones no publicadas, las de prueba operativa, y las que ya tienen su
 * concurso espejo en FotoRank —esas llegan por la consulta principal y se
 * duplicarían—.
 */
async function listPublicMarathonEditions(now: Date, limit: number): Promise<PublicHomeContestCard[]> {
  const editions = await prisma.clickatonEdition.findMany({
    where: {
      isPublished: true,
      isOpsFixture: false,
      status: { in: [...OPEN_EDITION_STATUSES] },
      fotorankContestId: null,
    },
    select: {
      slug: true,
      name: true,
      city: true,
      provinceOrState: true,
      coverImageUrl: true,
      startAt: true,
      registrationCloseAt: true,
    },
    orderBy: [{ registrationCloseAt: "asc" }, { startAt: "asc" }],
    take: limit * 2,
  });

  return editions.map((e) =>
    toPublicHomeContestCard({
      slug: e.slug,
      title: e.name,
      // Sin organización propia en el modelo: se ubica por sede, que es lo que
      // distingue una edición de otra.
      organizerName: [e.city, e.provinceOrState].filter(Boolean).join(", ") || "Maratón fotográfica",
      coverImageUrl: e.coverImageUrl,
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
 * Ordena por urgencia: primero lo que cierra antes. Las convocatorias sin fecha
 * de cierre van al final, porque no compiten por atención inmediata.
 */
export function sortHomeCards(cards: PublicHomeContestCard[]): PublicHomeContestCard[] {
  return [...cards].sort((a, b) => {
    const at = a.submissionDeadline?.getTime() ?? Number.POSITIVE_INFINITY;
    const bt = b.submissionDeadline?.getTime() ?? Number.POSITIVE_INFINITY;
    if (at !== bt) return at - bt;
    return a.title.localeCompare(b.title, "es");
  });
}

/**
 * Convocatorias públicas de la home: concursos y maratones en una sola lista.
 *
 * Las dos fuentes se consultan por separado y se unifican en el mismo tipo de
 * tarjeta, para que la home no tenga que saber de dónde vino cada una. Si la
 * consulta de maratones falla, los concursos igual se muestran: un problema en
 * un producto no debe vaciar la home del otro.
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

    return sortHomeCards([...fromContests, ...fromMarathons])
      .filter((c) => c.statusLabel !== "Cerrado")
      .slice(0, limit);
  } catch {
    // Home pública: degradar a lista vacía si no hay DB (preview / build local).
    return [];
  }
}
