/** Asunto de correo seguro (módulo PURO): sin saltos de línea ni caracteres de control, espacios colapsados. */
const CONTROLES = new RegExp("[\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029]+", "g");

export function limpiarAsunto(texto: string): string {
  return String(texto ?? "").replace(CONTROLES, " ").replace(/\s{2,}/g, " ").trim();
}
