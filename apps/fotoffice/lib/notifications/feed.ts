/**
 * Las novedades del socio (la campanita del portal). Módulo PURO.
 *
 * Las novedades no se guardan: cada módulo dice qué tiene de nuevo y acá se juntan, se ordenan
 * de la más nueva a la más vieja y se cuentan las que el socio todavía no vio. Así un módulo
 * nuevo suma sus avisos sin que nadie tenga que acordarse de "mandar una notificación", y no hay
 * avisos huérfanos de cosas que ya no existen.
 */

export type NoticeKind =
  | "blog"
  | "task_open"
  | "task_assigned"
  | "project"
  | "proposal"
  | "raffle"
  | "raffle_win"
  | "course"
  | "dues"
  | "coverage"
  | "spotlight"
  | "booking"
  | "contest"
  | "lead"
  | "meeting";

export type Notice = {
  /** Estable y único: "blog:123". Sirve para no repetir y como `key` de React. */
  key: string;
  kind: NoticeKind;
  title: string;
  body?: string | null;
  href: string;
  at: Date;
};

/** Cuánto para atrás se mira. Más viejo que esto ya no es novedad. */
export const NOTICE_WINDOW_DAYS = 45;

/** Cuántas se muestran en el desplegable. */
export const NOTICE_LIMIT = 40;

export function windowStart(now: Date): Date {
  return new Date(now.getTime() - NOTICE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/** Junta, saca repetidas, descarta lo futuro y lo viejo, y ordena de la más nueva a la más vieja. */
export function mergeNotices(groups: readonly (readonly Notice[])[], now: Date, limit = NOTICE_LIMIT): Notice[] {
  const desde = windowStart(now).getTime();
  const porClave = new Map<string, Notice>();
  for (const g of groups) {
    for (const n of g) {
      const t = n.at.getTime();
      if (Number.isNaN(t) || t > now.getTime() + 60_000 || t < desde) continue;
      const previa = porClave.get(n.key);
      if (!previa || previa.at.getTime() < t) porClave.set(n.key, n);
    }
  }
  return [...porClave.values()].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}

/** Las que llegaron después de la última vez que abrió la campanita. Sin registro: todas. */
export function unreadCount(notices: readonly Notice[], lastSeenAt: Date | null): number {
  if (!lastSeenAt) return notices.length;
  return notices.filter((n) => n.at.getTime() > lastSeenAt.getTime()).length;
}

/** El número del globito: más de 9 se muestra "9+". */
export function badgeText(count: number): string | null {
  if (count <= 0) return null;
  return count > 9 ? "9+" : String(count);
}

const ROTULO: Record<NoticeKind, string> = {
  blog: "Blog",
  task_open: "¡Necesitamos tu ayuda!",
  task_assigned: "Tus tareas",
  project: "Proyectos",
  proposal: "Tu propuesta",
  raffle: "Sorteos",
  raffle_win: "¡Ganaste!",
  course: "Cursos",
  dues: "Cuotas",
  coverage: "Coberturas",
  spotlight: "Socio de la semana",
  booking: "Reservas",
  contest: "Concursos",
  lead: "Pedidos de presupuesto",
  meeting: "Comisión",
};

export function noticeKindLabel(kind: NoticeKind): string {
  return ROTULO[kind];
}

/** "hace 5 min", "hace 3 h", "ayer", "hace 4 días", o la fecha. */
export function relativeTime(at: Date, now: Date): string {
  const seg = Math.max(0, Math.round((now.getTime() - at.getTime()) / 1000));
  if (seg < 60) return "recién";
  const min = Math.round(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d} días`;
  return new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit" }).format(at);
}
