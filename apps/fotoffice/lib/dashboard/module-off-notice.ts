/**
 * El aviso que muestra `/dashboard` cuando una guarda rebota porque el módulo está apagado.
 *
 * Cursos manda `?courses=off` desde siempre y tiene su texto. Socios y Captación mandan
 * `?module=off`, y Evaluaciones `?evaluaciones=off`: antes nadie leía esos parámetros, así que la
 * persona caía en el panel sin saber por qué.
 */
export function moduleOffNotice(sp: { courses?: string; module?: string; evaluaciones?: string }): string | null {
  if (sp.courses === "off") {
    return "El módulo «Venta de cursos» no está habilitado para este workspace. Contactá al administrador de la plataforma o elegí otro workspace.";
  }
  if (sp.module === "off" || sp.evaluaciones === "off") {
    return "Ese módulo no está activado para tu institución.";
  }
  return null;
}
