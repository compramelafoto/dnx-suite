/**
 * Qué hacer con una visita que llega por el dominio propio de una institución
 * (`sfpr.com.ar/...`). Función pura: el `proxy.ts` resuelve el dominio → slug y le pregunta acá.
 * Vive separada para poder probar la decisión entera sin levantar Next.
 */

export type CustomDomainDecision =
  /** Seguir sin tocar: recursos de Next, API, archivos estáticos. */
  | { kind: "pass" }
  /** Servir internamente `/w/<slug>/...` sin cambiar la dirección que ve el visitante. */
  | { kind: "rewrite"; pathname: string }
  /** Mandar al visitante a otra dirección (mismo dominio o el de FOTOFFICE). */
  | { kind: "redirect"; url: string };

/**
 * Primeros segmentos que NO son del sitio público: el panel, la sesión y las páginas propias de
 * FOTOFFICE. En el dominio propio redirigen al de FOTOFFICE, porque la cookie de sesión es de
 * ese dominio y acá el navegador no la manda.
 *
 * `reservas`, `sorteos`, `cursos` y `coberturas` NO están: en el panel son pantallas de gestión,
 * pero en el dominio propio son secciones del sitio (`/w/<slug>/reservas`).
 */
const FOTOFFICE_ONLY_SEGMENTS = new Set([
  "admin",
  "bienvenida",
  "c",
  "caja",
  "clientes",
  "courses",
  "dashboard",
  "elegir-perfil",
  "evaluaciones",
  "invitacion",
  "login",
  "members",
  "onboarding",
  "portal",
  "portfolios",
  "privacidad",
  "recuperar",
  "sc",
  "soy-socio",
  "terminos",
  "website",
  "workspace",
]);

/**
 * Segmentos del sitio que tienen que abrirse en el dominio de FOTOFFICE aunque vivan bajo
 * `/w/<slug>`: `entrar` inicia sesión, y la sesión sólo existe allá.
 */
const SITE_SEGMENTS_ON_FOTOFFICE = new Set(["entrar"]);

const STATIC_FILE = /\.(?:png|jpe?g|gif|webp|avif|svg|ico|mp4|webm|woff2?|ttf|css|js|map|pdf)$/i;

export function decideCustomDomainRoute(args: {
  pathname: string;
  search: string;
  slug: string;
  /** Dirección de FOTOFFICE sin barra final (`https://fotoffice...`). Vacía = no configurada. */
  fotofficeOrigin: string;
}): CustomDomainDecision {
  const { pathname, search, slug, fotofficeOrigin } = args;

  if (pathname.startsWith("/_next/") || pathname.startsWith("/api/") || STATIC_FILE.test(pathname)) {
    return { kind: "pass" };
  }

  const toFotoffice = (path: string): CustomDomainDecision =>
    fotofficeOrigin ? { kind: "redirect", url: `${fotofficeOrigin}${path}${search}` } : { kind: "pass" };

  // Enlaces que ya arman `/w/<slug>/...` (hay decenas): un salto y quedan limpios.
  const ownPrefix = `/w/${slug}`;
  if (pathname === ownPrefix || pathname.startsWith(`${ownPrefix}/`)) {
    const rest = pathname.slice(ownPrefix.length) || "/";
    const first = rest.split("/")[1] ?? "";
    if (SITE_SEGMENTS_ON_FOTOFFICE.has(first)) return toFotoffice(pathname);
    return { kind: "redirect", url: `${rest}${search}` };
  }
  // El sitio de OTRA institución no se sirve bajo este dominio.
  if (pathname.startsWith("/w/")) return toFotoffice(pathname);

  const first = pathname.split("/")[1] ?? "";
  if (FOTOFFICE_ONLY_SEGMENTS.has(first)) return toFotoffice(pathname);
  if (SITE_SEGMENTS_ON_FOTOFFICE.has(first)) return toFotoffice(`${ownPrefix}${pathname}`);

  return { kind: "rewrite", pathname: pathname === "/" ? ownPrefix : `${ownPrefix}${pathname}` };
}

/**
 * ¿Este `host` es de FOTOFFICE (y no un dominio propio)? Así la enorme mayoría de las visitas
 * no consulta la base.
 */
export function isFotofficeHost(host: string, fotofficeOrigin: string): boolean {
  if (!host) return true;
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".vercel.app")) return true;
  if (!fotofficeOrigin) return false;
  try {
    const own = new URL(fotofficeOrigin).hostname.toLowerCase();
    return host === own || host === `www.${own}` || `www.${host}` === own;
  } catch {
    return false;
  }
}
