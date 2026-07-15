/**
 * Rutas tipadas de assets oficiales Clickatón (Manual de Marca).
 * Fuente de verdad para Logo / metadata — no hardcodear paths en páginas.
 */

export const brandAssetPaths = {
  principal: "/brand/logo-principal.png",
  vertical: "/brand/logo-vertical.png",
  /** Horizontal color oficial con transparencia — header / UI oscura. */
  horizontal: "/brand/logo-horizontal-color.png",
  /** Alias UI del horizontal color. */
  horizontalWeb: "/brand/logo-horizontal-color.png",
  /** Horizontal mono (legado; preferir color en superficies oscuras). */
  horizontalMono: "/brand/logo-horizontal-mono.png",
  mono: "/brand/logo-mono-negro.png",
  isotipo: "/brand/isotipo.png",
  isotipoAmarillo: "/brand/isotipo-amarillo.png",
  isotipoGris: "/brand/isotipo-gris.png",
  favicon32: "/brand/favicon-32.png",
  appleTouchIcon: "/brand/apple-touch-icon.png",
  icon512: "/brand/icon-512.png",
  socialAvatar: "/brand/social-avatar.png",
  ogDefault: "/brand/og-default.png",
  logoSheet: "/brand/logo-sheet.png",
  manual: "/brand/manual-de-marca.png",
} as const;

export type BrandAssetKey = keyof typeof brandAssetPaths;

/** Variante recomendada por superficie de producto. */
export const brandAssetUsage = {
  hero: "principal",
  header: "horizontalWeb",
  /** Superficies oscuras / catálogo: horizontal color. */
  horizontalUi: "horizontalWeb",
  footerDark: "horizontalWeb",
  favicon: "favicon32",
  openGraph: "ogDefault",
} as const;
