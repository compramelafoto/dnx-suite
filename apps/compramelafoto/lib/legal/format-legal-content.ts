/** Convierte markdown básico de documentos legales a HTML seguro para dangerouslySetInnerHTML. */
export function formatLegalContent(content: string): string {
  return content
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");
}
