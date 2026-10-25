/**
 * «Quitar el fondo»: una opción del hueco de foto de la plantilla. La foto que cae ahí se imprime
 * recortada, sin fondo, apoyada sobre el dibujo de la plantilla (si hay recorte; si no, entera).
 */

export function quitaElFondo(config: unknown): boolean {
  return Boolean(config && typeof config === "object" && (config as Record<string, unknown>).removeBackground === true);
}

/** Los bloques de imagen (o foto) de la plantilla que piden la foto sin fondo. */
export function huecosSinFondo(blocks: ReadonlyArray<{ id: string; type: string; configJson?: unknown }>): Set<string> {
  return new Set(blocks.filter((b) => (b.type === "IMAGE" || b.type === "PHOTO") && quitaElFondo(b.configJson)).map((b) => b.id));
}
