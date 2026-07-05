/**
 * Identificador de foto en el carrito/checkout visible al cliente.
 * No debe usarse el originalKey de R2 en JSON expuesto al navegador.
 */
export function albumPhotoFileKey(photoId: number): string {
  return `photo:${photoId}`;
}

const COPY_SUFFIX_RE = /^(.+)_copy_\d+$/;

/** Ítems duplicados en UI usan fileKey `…_copy_<timestamp>`. */
export function stripCartCopySuffix(fileKey: string): string {
  const m = fileKey.match(COPY_SUFFIX_RE);
  return m?.[1] ?? fileKey;
}
