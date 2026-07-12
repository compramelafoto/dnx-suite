/**
 * URLs públicas CLF para eventos (canónico: /e/{shareSlug}).
 * No importa apps/compramelafoto; replica publicEventJoinPath.
 */

export function getClfPublicOrigin(): string {
  for (const raw of [
    process.env.COMPRAMELAFOTO_PUBLIC_URL,
    process.env.NEXT_PUBLIC_COMPRAMELAFOTO_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ]) {
    if (typeof raw === "string" && /^https?:\/\//i.test(raw.trim())) {
      return raw.trim().replace(/\/$/, "");
    }
  }
  return "https://compramelafoto.com";
}

/** Path relativo canónico (igual que publicEventJoinPath en CLF). */
export function publicEventJoinPath(shareSlug: string): string {
  return `/e/${shareSlug.trim().replace(/^\/+/, "")}`;
}

export function buildClfPublicEventUrl(shareSlug: string | null | undefined): string | null {
  if (!shareSlug?.trim()) return null;
  return `${getClfPublicOrigin()}${publicEventJoinPath(shareSlug)}`;
}
