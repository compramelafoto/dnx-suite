/**
 * Enlace único de un proyecto o una reunión, para pegar en el grupo de WhatsApp. Módulo PURO.
 *
 * Es el mismo enlace para todos: `/w/<institución>/proyecto/<id>`. Quien lo abre cae donde le
 * corresponde (la comisión, al proyecto completo; el socio, a la versión del portal) y quien no
 * inició sesión entra y vuelve al mismo lugar. El enlace no abre nada por sí mismo: cada pantalla
 * sigue autorizando por su cuenta.
 */

export type SharedKind = "proyecto" | "reunion";

/** Ids de Prisma (`cuid`) y slugs públicos: nada de barras, puntos ni parámetros. */
const ID = /^[a-z0-9]{1,40}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;
const ENLACE = /^\/w\/([a-z0-9][a-z0-9-]{0,62})\/(proyecto|reunion)\/([a-z0-9]{1,40})$/;

export function sharedPath(kind: SharedKind, slug: string, id: string): string {
  return `/w/${slug}/${kind}/${id}`;
}

/**
 * La dirección completa para compartir. Con un dominio propio conectado sale con ese dominio
 * (`sfpr.com.ar/proyecto/…`), que es el que la gente reconoce; el `proxy.ts` lo manda al de
 * FOTOFFICE, donde está la sesión. Sin dominio, la de FOTOFFICE. Sin ninguna de las dos
 * configurada, la ruta sola: sirve igual dentro de la aplicación.
 */
export function sharedUrl(args: {
  kind: SharedKind;
  slug: string;
  id: string;
  appOrigin: string;
  customDomain?: string | null;
}): string {
  if (args.customDomain) return `https://${args.customDomain}/${args.kind}/${args.id}`;
  return `${args.appOrigin}${sharedPath(args.kind, args.slug, args.id)}`;
}

/**
 * Si `next` (lo que vuelve del inicio de sesión) es un enlace compartido, lo devuelve tal cual;
 * si no, `null`. Estricto a propósito porque `next` lo escribe el navegador.
 */
export function sharedReturnPath(next: string | null | undefined): string | null {
  if (typeof next !== "string") return null;
  const value = next.trim();
  return ENLACE.test(value) ? value : null;
}

export function isValidSharedParams(slug: string, id: string): boolean {
  return SLUG.test(slug) && ID.test(id);
}

export type SharedViewer = {
  /** Es del equipo de la institución y ve Gobierno (nivel "Ver" o más). */
  commission: boolean;
  /** Ficha de socio activa en esa institución, o null. */
  memberId: string | null;
};

export type SharedDestination =
  | { kind: "panel"; path: string }
  | { kind: "portal"; path: string; memberWorkspace: true }
  | { kind: "door" };

/**
 * A dónde va quien abrió el enlace. La comisión primero: es la que vota y opina, aunque además
 * sea socia. Al socio se lo manda a su versión del proyecto; si no lo puede ver, el portal le
 * explica que es interno. Una reunión, al socio no le corresponde.
 */
export function decideSharedDestination(args: {
  kind: SharedKind;
  id: string;
  viewer: SharedViewer;
  /** El socio puede ver ese proyecto (visible, o propuesto por él). */
  memberCanSee: boolean;
}): SharedDestination {
  const { kind, id, viewer } = args;
  if (viewer.commission) {
    return { kind: "panel", path: kind === "proyecto" ? `/gobierno/${id}` : `/gobierno/reuniones/${id}` };
  }
  if (viewer.memberId) {
    if (kind === "proyecto" && args.memberCanSee) {
      return { kind: "portal", path: `/portal/proyectos/${id}`, memberWorkspace: true };
    }
    return { kind: "portal", path: `/portal/proyectos?aviso=${kind === "proyecto" ? "interno" : "reunion"}`, memberWorkspace: true };
  }
  return { kind: "door" };
}

// ─── Mensajes para WhatsApp ──────────────────────────────────────────────────

export function projectShareMessage(args: {
  title: string;
  url: string;
  votingOpen: boolean;
  /** Fecha de la próxima reunión ya formateada ("jueves 15/10"), si hay una convocada. */
  nextMeeting?: string | null;
}): string {
  const pedido = args.votingOpen
    ? args.nextMeeting
      ? `Entren a verlo, voten y dejen su opinión antes de la reunión del ${args.nextMeeting}.`
      : "Entren a verlo, voten y dejen su opinión."
    : "Entren a verlo.";
  return `Proyecto de la comisión: "${args.title}". ${pedido}\n${args.url}`;
}

export function meetingShareMessage(args: {
  title: string;
  when: string;
  location: string | null;
  topics: readonly string[];
  url: string;
}): string {
  const lineas = [`${args.title}: ${args.when}${args.location ? ` · ${args.location}` : ""}.`];
  if (args.topics.length > 0) {
    lineas.push("", "Temario:");
    args.topics.forEach((t, i) => lineas.push(`${i + 1}. ${t}`));
    lineas.push("", "Antes de la reunión, entren a cada proyecto a votar y dejar su opinión.");
  }
  lineas.push(args.url);
  return lineas.join("\n");
}

export function whatsappHref(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
