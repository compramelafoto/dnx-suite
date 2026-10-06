/**
 * La vitrina de concursos que ve el socio: los concursos públicos de FotoRank y las ediciones de
 * Clickatón, juntos y en un orden que sirve. Módulo PURO.
 */

export type ShowcaseSource = "fotorank" | "clickaton";

/** En qué momento está el concurso, desde el punto de vista de quien quiere participar. */
export type ShowcasePhase = "open" | "upcoming" | "in_progress" | "results";

export type ShowcaseItem = {
  key: string;
  source: ShowcaseSource;
  title: string;
  organizer: string;
  summary: string | null;
  coverUrl: string | null;
  /** Hasta cuándo se puede participar, si se sabe. */
  closesAt: Date | null;
  /** Cuándo empieza (Clickatón: el día de la maratón). */
  startsAt: Date | null;
  /** Cuándo se abrió o anunció: lo usa la campanita para "concurso nuevo". */
  announcedAt: Date | null;
  phase: ShowcasePhase;
  url: string;
  /** Lo organiza esta misma institución: va primero y con su nombre. */
  own: boolean;
};

export type ShowcaseMode = "ALL" | "OWN" | "OFF";

export function isShowcaseMode(v: string): v is ShowcaseMode {
  return v === "ALL" || v === "OWN" || v === "OFF";
}

/** Estados de FotoRank → fase. `null`: no se muestra (borradores, archivados, cancelados). */
export function fotorankPhase(status: string, closesAt: Date | null, now: Date): ShowcasePhase | null {
  switch (status) {
    case "PUBLISHED":
    case "ACTIVE":
    case "REGISTRATION_OPEN":
      return closesAt && closesAt.getTime() < now.getTime() ? "in_progress" : "open";
    case "UPCOMING":
      return "upcoming";
    case "SUBMISSIONS_CLOSED":
    case "ADMISSION":
    case "JUDGING":
    case "FINALISTS":
      return "in_progress";
    case "COMPLETED":
    case "CLOSED":
      return "results";
    default:
      return null;
  }
}

/** Estado de inscripción de Clickatón → fase. */
export function clickatonPhase(registrationStatus: string, status: string): ShowcasePhase | null {
  if (status === "cancelled" || status === "archived") return null;
  if (registrationStatus === "open" || registrationStatus === "last_places") return "open";
  if (registrationStatus === "coming_soon" || status === "announced") return "upcoming";
  return "in_progress";
}

const PESO: Record<ShowcasePhase, number> = { open: 0, upcoming: 1, in_progress: 2, results: 3 };

/**
 * El orden de la vitrina: lo de la institución primero; después lo abierto (lo que cierra antes,
 * primero), lo que viene, lo que se está juzgando y los resultados.
 */
export function sortShowcase(items: readonly ShowcaseItem[]): ShowcaseItem[] {
  return items.slice().sort((a, b) => {
    if (a.own !== b.own) return a.own ? -1 : 1;
    if (PESO[a.phase] !== PESO[b.phase]) return PESO[a.phase] - PESO[b.phase];
    const fa = (a.closesAt ?? a.startsAt)?.getTime() ?? Number.POSITIVE_INFINITY;
    const fb = (b.closesAt ?? b.startsAt)?.getTime() ?? Number.POSITIVE_INFINITY;
    return fa - fb;
  });
}

/** Lo que entra en la franja de la portada: sólo lo que todavía se puede hacer. */
export function bannerItems(items: readonly ShowcaseItem[], max = 6): ShowcaseItem[] {
  return sortShowcase(items.filter((i) => i.phase === "open" || i.phase === "upcoming")).slice(0, max);
}

const DIA = 24 * 60 * 60 * 1000;

/** Días enteros que faltan (0 = hoy). `null` si ya pasó o no hay fecha. */
export function daysLeft(until: Date | null, now: Date): number | null {
  if (!until) return null;
  const ms = until.getTime() - now.getTime();
  if (ms < 0) return null;
  return Math.floor(ms / DIA);
}

const ZONA = "America/Argentina/Buenos_Aires";
const dia = (d: Date) => new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, day: "2-digit", month: "2-digit" }).format(d);

/** La línea de fecha de la tarjeta: "Cierra el 01/11 · quedan 26 días". */
export function deadlineLine(item: Pick<ShowcaseItem, "phase" | "closesAt" | "startsAt" | "source">, now: Date): string {
  if (item.phase === "results") return "Resultados publicados";
  if (item.phase === "in_progress") return item.source === "clickaton" ? "En curso" : "En evaluación";
  if (item.phase === "upcoming") {
    return item.startsAt ? `Próximamente · ${dia(item.startsAt)}` : "Próximamente";
  }
  const quedan = daysLeft(item.closesAt, now);
  if (item.closesAt && quedan !== null) {
    const resto = quedan === 0 ? "cierra hoy" : quedan === 1 ? "queda 1 día" : `quedan ${quedan} días`;
    return `Cierra el ${dia(item.closesAt)} · ${resto}`;
  }
  if (item.source === "clickaton" && item.startsAt) return `${dia(item.startsAt)} · inscripción abierta`;
  return "Inscripción abierta";
}

export function ctaLabel(item: Pick<ShowcaseItem, "source" | "phase">): string {
  if (item.phase === "results") return "Ver resultados";
  if (item.phase === "in_progress" || item.phase === "upcoming") return "Ver concurso";
  return item.source === "clickaton" ? "Inscribirme" : "Participar";
}

/** Agrega la marca de origen al enlace, para medir desde qué institución llega cada uno. */
export function withTracking(url: string, campaign: string | null): string {
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", "fotoffice");
    u.searchParams.set("utm_medium", "vitrina");
    if (campaign) u.searchParams.set("utm_campaign", campaign);
    return u.toString();
  } catch {
    return url;
  }
}
