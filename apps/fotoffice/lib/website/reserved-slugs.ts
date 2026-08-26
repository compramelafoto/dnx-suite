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
  "onboarding", "recuperar", "w", "website", "workspace",
] as const;
