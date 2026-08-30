export type AlbumCleanupConfig = {
  enabled: boolean;
  /** Si true, solo encola y reporta; no borra R2 ni metadata. */
  dryRun: boolean;
  /** Si true, permite hard delete de filas Photo/Album. Requiere ALBUM_CLEANUP_DESTRUCTIVE_DELETE=true explícito. */
  destructiveDelete: boolean;
  maxAlbumsPerRun: number;
  maxPhotosPerRun: number;
  maxExternalOpsPerRun: number;
  retentionDays: number;
  hideAfterDays: number;
};

// Los topes son altos a propósito: el corte real de cada corrida lo pone el
// maxDuration de la ruta del cron, no estos números. El pipeline es idempotente
// y retoma donde quedó, así que un corte por tiempo no deja nada a medio hacer.
function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export function getAlbumCleanupConfig(): AlbumCleanupConfig {
  return {
    enabled: process.env.ALBUM_CLEANUP_ENABLED !== "false",
    dryRun: process.env.ALBUM_CLEANUP_DRY_RUN === "true",
    destructiveDelete: process.env.ALBUM_CLEANUP_DESTRUCTIVE_DELETE === "true",
    maxAlbumsPerRun: clampInt(Number(process.env.ALBUM_CLEANUP_MAX_ALBUMS ?? 2), 1, 1000),
    maxPhotosPerRun: clampInt(Number(process.env.ALBUM_CLEANUP_MAX_PHOTOS ?? 150), 10, 50_000),
    maxExternalOpsPerRun: clampInt(
      Number(process.env.ALBUM_CLEANUP_MAX_EXTERNAL_OPS ?? 200),
      20,
      200_000
    ),
    retentionDays: clampInt(Number(process.env.ALBUM_CLEANUP_RETENTION_DAYS ?? 45), 30, 365),
    hideAfterDays: clampInt(Number(process.env.ALBUM_CLEANUP_HIDE_DAYS ?? 30), 7, 120),
  };
}
