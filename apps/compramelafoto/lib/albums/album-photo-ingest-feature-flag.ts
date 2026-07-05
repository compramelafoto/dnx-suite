function parseTruthyEnv(raw: string | undefined): boolean | null {
  if (raw == null || raw === "") return null;
  const v = raw.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  return null;
}

/** Server: procesar complete como encolado (no Sharp en request). Opt-in: requiere worker o cron. */
export function isAsyncAlbumPhotoIngestEnabled(): boolean {
  const parsed = parseTruthyEnv(process.env.ASYNC_ALBUM_PHOTO_INGEST);
  if (parsed != null) return parsed;
  return false;
}

/** Client: usar complete-light tras PUT/proxy. Opt-in: debe coincidir con el servidor. */
export function isAsyncAlbumPhotoIngestEnabledClient(): boolean {
  const parsed = parseTruthyEnv(process.env.NEXT_PUBLIC_ASYNC_ALBUM_PHOTO_INGEST);
  if (parsed != null) return parsed;
  return false;
}
