import { FOTOFFICE_ONLY_SEGMENTS } from "./domain/routing";
import { SITE_RESERVED_SEGMENTS } from "./public-modules";

/**
 * DOCUMENTACIÓN PARA UNA ETAPA FUTURA — no se usa en ningún lado todavía.
 *
 * Cuando se implemente `fotoffice.com/{slug}` (decisión de producto ya tomada, ver informe de
 * la etapa de rediseño UX del CMS — NO implementada en esta etapa), el slug público de un
 * workspace no podrá colisionar con ninguna ruta real de la app ni con esta lista de reservadas
 * (español + inglés, singular y plural donde aplica, por si el slug se valida sin importar el
 * idioma o la forma que elija quien lo pide).
 *
 * Antes de implementar esa validación: regenerar `FOTOFFICE_TOP_LEVEL_APP_ROUTES` auditando
 * `apps/fotoffice/app/**` (rutas de primer nivel reales), no mantenerla a mano — se desactualiza
 * sola apenas se agregue una ruta nueva. Un test (`reserved-slugs.test.ts`) verifica que toda
 * ruta real listada ahí también esté en `FOTOFFICE_RESERVED_SLUGS`.
 */
export const FOTOFFICE_RESERVED_SLUGS = [
  "admin", "administrador", "administracion",
  "api",
  "auth", "oauth",
  "login", "iniciar-sesion", "signin", "signup", "registro", "register",
  "logout", "cerrar-sesion",
  "workspace", "espacio",
  "website", "sitio", "sitio-web", "web", "w",
  "dashboard", "panel",
  "editor",
  "preview", "vista-previa",
  "courses", "course", "cursos", "curso",
  "members", "member", "socios", "socio",
  "portfolios", "portfolio",
  "users", "user", "usuarios", "usuario",
  "settings", "configuracion", "configuration",
  "billing", "facturacion",
  "payments", "pagos",
  "help", "ayuda", "support", "soporte",
  "terms", "terminos", "privacy", "privacidad",
  "assets", "uploads", "media", "static", "public",
  "favicon", "robots", "sitemap",
  "evaluaciones", "onboarding", "recuperar",
] as const;

/**
 * Rutas top-level reales de `apps/fotoffice/app/` a la fecha de esta etapa (auditadas a mano una
 * vez — la fuente central que reemplace esto en la etapa de implementación debe derivarlas del
 * filesystem, no copiarlas). Se listan acá para que la futura validación no dependa solo de la
 * lista genérica de arriba.
 */
export const FOTOFFICE_TOP_LEVEL_APP_ROUTES = [
  "admin", "api", "courses", "cursos", "dashboard", "evaluaciones", "login", "members",
  "onboarding", "portfolios", "recuperar", "w", "website", "workspace",
] as const;

/**
 * Segmentos que una página propia del sitio de un workspace NO puede usar como dirección. Es la
 * ÚNICA lista que consulta `validatePageSlug` (ver `pages.ts`) al crear o renombrar una página, y
 * junta tres fuentes para no repetirlas a mano:
 *
 * - las carpetas reales bajo `app/w/[workspaceSlug]/` y rutas fijas del sitio (`SITE_FOLDER_SEGMENTS`);
 * - las páginas de módulos y opcionales del sitio (`SITE_RESERVED_SEGMENTS`, `public-modules.ts`);
 * - los segmentos que en el dominio propio se mandan a FOTOFFICE (`FOTOFFICE_ONLY_SEGMENTS`,
 *   `domain/routing.ts`): una página `privacidad` andaría en `/w/<slug>/privacidad` pero en el
 *   dominio propio redirigiría a otro lado.
 *
 * Un test recorre las carpetas reales de `app/w/[workspaceSlug]/` y falla si aparece una que no
 * esté acá, así que al crear una ruta nueva hay que sumarla a `SITE_FOLDER_SEGMENTS`.
 */
const SITE_FOLDER_SEGMENTS = [
  // Carpetas bajo app/w/[workspaceSlug]/
  "archivos", "asociarse", "blog", "coberturas", "contrato", "cursos", "entrar", "galeria",
  "impresion", "institucional", "obras", "pedido", "presupuesto", "proyecto", "recibo",
  "reservas", "reunion", "socios", "sorteos", "testimonio", "testimonios", "tienda", "trabajos", "videos", "xv",
  // Rutas fijas del sitio que no son carpetas de esa ruta
  "insertar", "api", "w", "sitemap.xml", "robots.txt",
] as const;

export const RESERVED_SITE_SEGMENTS: readonly string[] = [
  ...new Set([...SITE_FOLDER_SEGMENTS, ...SITE_RESERVED_SEGMENTS, ...FOTOFFICE_ONLY_SEGMENTS]),
];
