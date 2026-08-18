/**
 * Forma de un bloque de portada del Sitio web. Es un CONTRATO de diseño, todavía sin
 * renderer ni UI de edición — se persiste en `FotofficeWorkspaceWebsite.sectionsJson`
 * (un array de `WebsiteBlock`), pero ningún código lo lee ni lo escribe todavía.
 *
 * `type` queda como `string` (no union cerrada) a propósito: cerrar la union es trabajo
 * de cuando se implemente cada bloque real. Candidatos ya identificados (NINGUNO
 * implementado): "hero", "text", "courses-upcoming", "members-directory", "sponsors",
 * "cta", "custom".
 */
export type WebsiteBlock = {
  id: string;
  type: string;
  visible: boolean;
  order: number;
  title?: string;
  /** Configuración propia del bloque — shape depende de `type`. */
  config: unknown;
};
