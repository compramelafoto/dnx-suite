/**
 * El menú del panel del fotógrafo.
 *
 * Hasta el 2026-10-09 no había ninguno: trece pantallas sueltas, cada una un callejón
 * sin salida del que se volvía con el botón "atrás" del navegador. Para ir del QR a
 * Moderación había que volver al evento y entrar de nuevo.
 */

export type Seccion = {
  href: string;
  texto: string;
  /** Una línea de qué se hace ahí. Se muestra en el menú ancho. */
  ayuda?: string;
};

export function seccionesDelPanel(): Seccion[] {
  return [
    { href: "/panel", texto: "Mis eventos" },
    { href: "/panel/perfil", texto: "Mi perfil y precios" },
    { href: "/panel/arrepentimientos", texto: "Arrepentimientos" },
  ];
}

export function seccionesDelEvento(eventoId: string): Seccion[] {
  const en = (sufijo = "") => `/panel/eventos/${eventoId}${sufijo}`;

  return [
    { href: en(), texto: "Resumen", ayuda: "Horarios y código" },
    { href: en("/portada"), texto: "Portada y nombre", ayuda: "La foto y de quién es la fiesta" },
    { href: en("/plantilla"), texto: "Estilo", ayuda: "Colores, letra y textura" },
    { href: en("/qr"), texto: "QR y materiales", ayuda: "Para imprimir" },
    { href: en("/pantalla"), texto: "Pantalla y proyección", ayuda: "El enlace para el DJ" },
    { href: en("/control"), texto: "Control en vivo", ayuda: "Sacar una foto al toque" },
    { href: en("/moderacion"), texto: "Moderación", ayuda: "Revisar lo retenido" },
    { href: en("/proveedores"), texto: "Proveedores", ayuda: "Quién más trabajó" },
  ];
}

/** Sin la barra final, para que `/panel/perfil` y `/panel/perfil/` sean lo mismo. */
const normalizar = (ruta: string) => (ruta.length > 1 ? ruta.replace(/\/+$/, "") : ruta);

/**
 * Si este ítem del menú corresponde a la pantalla en la que estoy.
 *
 * **No alcanza con comparar por prefijo.** `/panel` es prefijo de las trece pantallas y
 * quedaría marcado siempre; `/panel/eventos/abc` es prefijo de todas las secciones del
 * evento y pasaría lo mismo un nivel más abajo.
 *
 * Por eso los dos resúmenes —el del panel y el del evento— piden coincidencia exacta, y
 * el resto acepta que la ruta siga más abajo: si mañana hay
 * `/moderacion/bloqueadas`, "Moderación" tiene que seguir marcada.
 *
 * El prefijo se compara con la barra incluida para que `/q` no marque a `/qr`.
 */
export function estaActivo(href: string, rutaActual: string): boolean {
  const item = normalizar(href);
  const actual = normalizar(rutaActual);

  if (item === actual) return true;

  // Los resúmenes sólo se marcan en coincidencia exacta.
  const esResumen = item === "/panel" || /^\/panel\/eventos\/[^/]+$/.test(item);
  if (esResumen) return false;

  return actual.startsWith(`${item}/`);
}
