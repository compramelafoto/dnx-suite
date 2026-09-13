/**
 * Sanear el "volver a" de `transferAction`. Módulo PURO.
 *
 * `returnTo` llega de un campo oculto del formulario (hoy sólo lo llenan `/caja/turnos` y
 * `/caja/pases`), pero nada impide que el día de mañana alguien arme un `<form>` con otro
 * valor, o que se copie el patrón a otra acción sin este cuidado. Es el patrón clásico de
 * "redirección abierta": si se usara tal cual para armar el `redirect`, una URL externa
 * (`https://otro-sitio`) o con esquema (`javascript:`) terminaría redirigiendo fuera del
 * sitio. Hoy el riesgo es bajo —las Server Actions de Next sólo aceptan POST del mismo
 * origen—, pero validar acá es gratis y evita dejar el hábito instalado.
 */
export function sanitizeReturnTo(value: string | null | undefined, fallback: string): string {
  const v = (value ?? "").trim();
  // Tiene que ser una ruta propia del sitio: empezar con una sola "/". "//otro-host" es una
  // URL *scheme-relative* (el navegador la resuelve contra otro host, no contra el propio) y
  // se rechaza igual que un esquema explícito (`http:`, `javascript:`, etc.).
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  return fallback;
}
