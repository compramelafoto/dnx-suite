/**
 * Top bar / app header (suite DNX: FotoRank, ComprameLaFoto, …).
 *
 * Layout en **flexbox** (tres zonas en md+; móvil solo izquierda + derecha).
 * Contenedor: `max-w-[1280px] mx-auto`, padding `16px` / `24px`, altura de fila **64px** (landing; dashboard puede usar logo alto).
 *
 * **Regla de producto:** en shells FotoRank, la zona **CENTER** va **vacía** (`center={null}`).
 * La navegación global no es una tira horizontal en el header: va en **FullscreenMenu** y, en dashboard, en el **sidebar**.
 *
 * @see `packages/design-system/docs/APP_SHELL_HEADER.md`
 */

import { spacing } from "./spacing";

export const appShellHeader = {
  /** Altura fija de la fila del header (64px) */
  rowHeight: "4rem",

  maxWidthPx: 1280,

  /**
   * Padding horizontal del contenedor interno.
   * Tailwind: `px-4` (16px) / `md:px-6` (24px).
   */
  paddingX: {
    base: spacing[4],
    md: spacing[6],
  },

  /** Gap mínimo entre ítems de zona y entre enlaces del nav (12px → 16px) */
  zoneGap: {
    base: spacing[3],
    md: spacing[4],
  },

  navItemGap: {
    base: spacing[3],
    lg: spacing[4],
  },

  navLinkPaddingX: spacing[2],

  circularAction: {
    hitMin: "44px",
    iconSize: "20px",
  },

  /**
   * Zona derecha del header (landing / público): orden de controles.
   * 1 = panel solo con sesión, 2 = login|logout, 3 = menú dorado.
   * @see `docs/APP_SHELL_HEADER.md` — «Orden de iconos en zona RIGHT»
   */
  rightClusterOrder: ["dashboardIfSession", "session", "fullscreenMenu"] as const,

  /** Banda sidebar dashboard (referencia histórica; el header actual usa contenedor centrado). */
  dashboardSidebarBandPx: 280,

  priorityHideRank: {
    high: 0,
    medium: 1,
    low: 2,
  } as const,

  /**
   * Shell público / marketing (ComprameLaFoto, landings de suite): logo alto + acciones a la derecha.
   * Valores hex alineados a barra FotoRank (dorado #D4AF37, fondo #050505).
   * @see `docs/PUBLIC_MARKETING_SHELL.md`
   */
  publicShell: {
    background: "rgba(5, 5, 5, 0.9)",
    borderBottom: "1px solid #1a1a1a",
    accentGold: "#D4AF37",
    accentGoldHover: "#e5c04a",
    onAccent: "#050505",
    maxInnerWidthPx: 1280,
    /** Logo wordmark: misma escala relativa que FotoRank dashboard (clamp evita media queries en estilos inline). */
    logoMaxHeight: "clamp(3.25rem, 10vw, 8rem)",
    logoMaxWidth: "min(72vw, 18rem)",
    /** Clases Tailwind equivalentes si la app usa `@import "tailwindcss"` y escanea el paquete. */
    tailwind: {
      logoWordmarkRelaxed:
        "h-[5rem] w-auto max-w-[min(72vw,11rem)] object-contain object-left sm:h-[6rem] sm:max-w-[13rem] md:h-[7rem] md:max-w-[16rem] lg:h-[8rem] lg:max-w-[18rem]",
      headerInnerRelaxed:
        "mx-auto flex min-h-[5.5rem] w-full max-w-[1280px] items-center justify-between gap-3 px-4 py-2 md:min-h-[6.5rem] md:px-6 md:py-2.5",
    },
  },

  /**
   * Shell público ComprameLaFoto: misma geometría que `publicShell` (logo grande, cluster derecho),
   * fondo claro y acento terracota (#c27b3d) en lugar del dorado FotoRank.
   * @see `PublicMarketingHeader` · `variant="comprameLaFotoLight"`
   */
  comprameLaFotoPublic: {
    background: "rgba(255, 255, 255, 0.92)",
    borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
    accent: "#c27b3d",
    accentHover: "#a86a33",
    /** Texto sobre botón menú relleno */
    onAccent: "#ffffff",
    maxInnerWidthPx: 1280,
    logoMaxHeight: "clamp(3.25rem, 10vw, 8rem)",
    logoMaxWidth: "min(72vw, 18rem)",
  },
} as const;

export type AppShellHeader = typeof appShellHeader;
