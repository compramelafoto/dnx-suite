/**
 * Después de que el bot responde, el cursor vuelve al renglón para seguir escribiendo sin tocar el mouse.
 * En celular sólo si la persona venía escribiendo (si no, abrir el teclado sola molesta).
 */
export function debeVolverAlInput(p: { ventanaAbierta: boolean; punteroTactil: boolean; veniaEscribiendo: boolean; focoEnOtroCampo: boolean }): boolean {
  if (!p.ventanaAbierta) return false;
  // Si la persona se fue a escribir a otro campo de la página, no se lo sacamos.
  if (p.focoEnOtroCampo) return false;
  return p.punteroTactil ? p.veniaEscribiendo : true;
}

/** true si el foco está en un campo de texto que no es el del bot. */
export function esOtroCampoDeTexto(activo: Element | null, propio: Element | null): boolean {
  if (!activo || activo === propio) return false;
  const tag = activo.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (activo as HTMLElement).isContentEditable === true;
}
