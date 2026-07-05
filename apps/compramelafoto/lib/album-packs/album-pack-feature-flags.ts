function rawFlag(name: string): string {
  return process.env[name]?.trim().toLowerCase() ?? "";
}

export function isAlbumPackPublicPayEnabled(): boolean {
  const v = rawFlag("ALBUM_PACK_PUBLIC_PAY_ENABLED");
  return v === "1" || v === "true" || v === "yes";
}

/** Checkout MP de AlbumPack sólo cuando el flag global y el permiso por álbum están activos. */
export function isAlbumPackPaymentGloballyAllowedForAlbum(
  albumPackPayEnabled: boolean | null | undefined
): boolean {
  return isAlbumPackPublicPayEnabled() && Boolean(albumPackPayEnabled);
}
