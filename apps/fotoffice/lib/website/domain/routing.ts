/**
 * Qué hacer con una visita que llega por el dominio propio de una institución
 * (`sfpr.com.ar/...`). Función pura: el `proxy.ts` resuelve el dominio → slug y le pregunta acá.
 * Vive separada para poder probar la decisión entera sin levantar Next.
 */

import { rutaInternaInsertada } from "@/lib/service-leads/insertar";

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
 * `sorteos`, `cursos` y `coberturas` NO están: en el panel son pantallas de gestión, pero en el
 * dominio propio son secciones del sitio. `reservas` tampoco está acá, pero sí en
 * `SITE_SEGMENTS_ON_FOTOFFICE`: es del sitio, y se abre en el dominio de FOTOFFICE.
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
 * `/w/<slug>`, porque necesitan saber quién es la persona y la sesión sólo existe allá:
 *
 * - `entrar` inicia sesión.
 * - `reservas` cobra distinto al socio que al que no lo es. En el dominio propio el navegador
 *   no manda la cookie de FOTOFFICE, así que ahí todo socio se vería como no socio y pagaría
 *   la tarifa plena. Allá se lo reconoce y se lo lleva a su portal.
 * - `proyecto` y `reunion` son los enlaces de la comisión para compartir por WhatsApp
 *   (`lib/governance/share.ts`): deciden según quién los abre.
 */
const SITE_SEGMENTS_ON_FOTOFFICE = new Set(["entrar", "reservas", "proyecto", "reunion"]);

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

  const sitio = pathname === "/" ? ownPrefix : `${ownPrefix}${pathname}`;
  // `/insertar[/<formulario>]`: el formulario solo, para insertar en otra web (sin el armazón).
  return { kind: "rewrite", pathname: rutaInternaInsertada(sitio) ?? sitio };
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
