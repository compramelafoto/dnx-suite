/**
 * El atajo `fotoffice.com/sfpr` y los nombres que ninguna institución puede usar.
 *
 * La dirección pública canónica sigue siendo `/w/<slug>`: ahí viven el formulario de
 * asociarse, los cursos y las reservas, y los enlaces ya repartidos apuntan ahí. El atajo
 * solo la deja escribir sin el `/w/`, que es como se dice por teléfono y como entra en una
 * tarjeta.
 *
 * El costo de esa comodidad es que el primer nivel de la URL pasa a estar compartido entre
 * las pantallas de FotoOffice y los nombres de las instituciones. Una institución llamada
 * `login` volvería el inicio de sesión inalcanzable para todos. De ahí la lista de abajo, y
 * de ahí que no se la mantenga a mano: `institution-shortcut.test.ts` la contrasta contra las
 * carpetas reales de `app/` y falla si alguien agrega una pantalla sin reservar su nombre.
 */

/**
 * Nombres tomados. Salen de dos lugares distintos y por eso conviene leerlos juntos:
 *
 * - Las rutas que existen hoy. El test las verifica una por una.
 * - Nombres que todavía no son rutas pero que se van a querer, o que confunden si los toma
 *   una institución: `admin`, `api`, `app`, `ayuda`, `soporte`, `www`. Reservarlos ahora sale
 *   gratis; recuperarlos después de que una institución los use, no.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // Rutas reales de la aplicación.
  "actions",
  "admin",
  "api",
  "bienvenida",
  "c",
  "caja",
  "cliente",
  "clientes",
  "coberturas",
  "courses",
  "cursos",
  "dashboard",
  "elegir-perfil",
  "evaluaciones",
  "invitacion",
  "login",
  "members",
  "onboarding",
  "portal",
  "privacidad",
  "recuperar",
  "reservas",
  "sc",
  "sorteos",
  "soy-socio",
  "terminos",
  "ventas",
  "w",
  "website",
  "workspace",

  // Reservados por las dudas, antes de que los tome alguien.
  "app",
  "ayuda",
  "blog",
  "contacto",
  "cuenta",
  "docs",
  "fotoffice",
  "help",
  "legal",
  "precios",
  "public",
  "root",
  "settings",
  "signin",
  "signup",
  "soporte",
  "static",
  "status",
  "support",
  "www",
]);

/** Normaliza como corresponde comparar algo que viene de la URL: sin espacios y en minúsculas. */
function normalizar(slug: string): string {
  return slug.trim().toLowerCase();
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(normalizar(slug));
}

/**
 * Si un nombre candidato se puede asignar a una institución nueva.
 *
 * Un reservado cuenta como TOMADO, igual que uno que ya usa otra institución. Así el bucle que
 * asigna slugs no necesita saber nada del atajo: sigue probando hasta encontrar uno libre, y
 * "Portal" termina siendo `portal-a3f2` en vez de tapar la pantalla `/portal`.
 */
export function isSlugTaken(input: { slug: string; existsInDb: boolean }): boolean {
  return input.existsInDb || isReservedSlug(input.slug);
}

/**
 * A dónde mandar `fotoffice.com/<algo>`, o `null` si no es un atajo.
 *
 * Lo resuelve el middleware, antes de que Next elija una ruta. Se probó primero como una
 * página `app/[workspaceSlug]/page.tsx` y se descartó: un segmento dinámico en la raíz vuelve
 * "página interna" a cualquier dirección de un nivel, y la regla
 * `@next/next/no-html-link-for-pages` empezó a marcar cuatro `<a href>` de pantallas ajenas.
 * Acomodar eso obligaba a editar código que anda —el botón "Limpiar" de caja usa recarga
 * completa a propósito— y un atajo no vale ese precio.
 *
 * Redirige en vez de mostrar el contenido acá mismo: así hay una sola dirección real por
 * institución. Dos URLs con lo mismo confunden a los buscadores y hacen que la gente comparta
 * la mitad de las veces una y la mitad la otra.
 *
 * No consulta la base: si esa institución no existe, `/w/<slug>` responde 404 por su cuenta.
 * Hacer una consulta por cada dirección desconocida solo para adelantar ese 404 sería pagar
 * una ida a la base en el middleware —que corre en TODAS las peticiones— a cambio de nada.
 */
export function institutionShortcutRedirect(pathname: string): string | null {
  // Un solo nivel, el alfabeto de los slugs, sin punto (eso sería un archivo). La barra final
  // se tolera porque la gente la escribe; todo lo demás se descarta en vez de sanearse.
  const match = /^\/([a-z0-9][a-z0-9-]*)\/?$/.exec(pathname);
  const slug = match?.[1];
  if (!slug) return null;
  if (isReservedSlug(slug)) return null;
  return `/w/${slug}`;
}
