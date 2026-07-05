function parseTruthyEnv(raw: string | undefined): boolean {
  if (raw == null || raw === "") return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Vista comercial unificada (read-only) en dashboard de álbum. Default: false. */
export function isAlbumCommercialUnifiedUiEnabled(): boolean {
  return (
    parseTruthyEnv(process.env.ALBUM_COMMERCIAL_UNIFIED_UI) ||
    parseTruthyEnv(process.env.NEXT_PUBLIC_ALBUM_COMMERCIAL_UNIFIED_UI)
  );
}

/** Mismo flag en componentes cliente (NEXT_PUBLIC). */
export function isAlbumCommercialUnifiedUiEnabledClient(): boolean {
  return parseTruthyEnv(process.env.NEXT_PUBLIC_ALBUM_COMMERCIAL_UNIFIED_UI);
}
