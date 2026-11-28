/**
 * Fotos digitales de un pedido: las líneas del pedido más las que se sumaron después de pagar
 * (pack «Todas mis fotos» de un evento de varios días). Sin repetir, en el orden en que llegan.
 */
export function mergeOrderDigitalPhotoIds(
  itemPhotoIds: ReadonlyArray<number | null | undefined>,
  addedPhotoIds: ReadonlyArray<number | null | undefined>
): number[] {
  const seen = new Set<number>();
  const result: number[] = [];
  for (const raw of [...itemPhotoIds, ...addedPhotoIds]) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

/** ¿El ZIP ya armado tiene todas las fotos que hoy tiene el pedido? Si se sumaron fotos, no. */
export function zipJobCoversPhotos(
  jobPhotoIds: ReadonlyArray<number>,
  currentPhotoIds: ReadonlyArray<number>
): boolean {
  // Un ZIP viejo sin lista arma las fotos de las líneas del pedido: no incluye las sumadas.
  if (jobPhotoIds.length === 0) return false;
  const inJob = new Set(jobPhotoIds.map(Number));
  return currentPhotoIds.every((id) => inJob.has(id));
}

/** Meta del ZIP que se rearma porque se sumaron fotos: no repite el mail de «tu descarga está lista». */
export const GROWING_PACK_ZIP_META = { growingPackRefresh: true } as const;

export function isGrowingPackZipRefresh(meta: unknown): boolean {
  return (
    !!meta &&
    typeof meta === "object" &&
    (meta as Record<string, unknown>).growingPackRefresh === true
  );
}
