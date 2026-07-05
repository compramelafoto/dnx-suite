const DEFAULT_PUBLIC_ORIGIN = "https://www.compramelafoto.com";

export type AdminLandingKind = "photographer" | "organizer" | "lab";

export function resolveAdminPublicOrigin(windowOrigin?: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (typeof windowOrigin === "string") {
    if (windowOrigin.includes("localhost") || windowOrigin.includes("127.0.0.1")) {
      return (fromEnv || DEFAULT_PUBLIC_ORIGIN).replace(/\/$/, "");
    }
    return windowOrigin.replace(/\/$/, "");
  }
  return (fromEnv || DEFAULT_PUBLIC_ORIGIN).replace(/\/$/, "");
}

export function buildAdminLandingUrl(
  kind: AdminLandingKind,
  handler: string | null | undefined,
  origin?: string
): string | null {
  const h = handler?.trim();
  if (!h) return null;
  const base = resolveAdminPublicOrigin(origin);
  return kind === "lab" ? `${base}/l/${h}` : `${base}/${h}`;
}
