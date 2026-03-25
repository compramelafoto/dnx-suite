/** Lista negra: segmentos reservados que no pueden usarse como handler de fotógrafo (rutas estáticas de la app). */
const RESERVED_PHOTOGRAPHER_ROOTS = new Set([
  "a",
  "admin",
  "api",
  "ayuda",
  "cliente",
  "dashboard",
  "demo-ui",
  "design-system-test",
  "f",
  "fotografo",
  "fotocarnet",
  "fotocarnet-test",
  "forgot-password",
  "imprimir",
  "imprimir-publico",
  "invite",
  "l",
  "lab",
  "login",
  "polaroids",
  "polaroids-test",
  "pago",
  "registro",
  "reset-password",
  "terminos",
  "tutoriales",
  "test",
  "verify-email",
  "support",
  "public",
  "demo",
  "app",
]);

const VALID_SLUG_REGEX = /^[a-z0-9-]+$/;

export function isReservedPhotographerSlug(slug?: string | null): boolean {
  if (!slug) {
    return false;
  }
  return RESERVED_PHOTOGRAPHER_ROOTS.has(slug.toLowerCase());
}

export function looksLikePhotographerSlug(slug?: string | null): boolean {
  if (!slug) {
    return false;
  }
  const normalized = slug.toLowerCase();
  if (isReservedPhotographerSlug(normalized)) {
    return false;
  }
  return VALID_SLUG_REGEX.test(normalized);
}

/** True si pathname es una ruta de fotógrafo: /f/handler (legacy) o /handler (raíz). */
export function isPhotographerPath(pathname?: string): boolean {
  if (!pathname) {
    return false;
  }
  if (pathname.startsWith("/f/")) {
    return true;
  }
  const segments = pathname.split("/").filter(Boolean);
  if (!segments.length) {
    return false;
  }
  return looksLikePhotographerSlug(segments[0]);
}
