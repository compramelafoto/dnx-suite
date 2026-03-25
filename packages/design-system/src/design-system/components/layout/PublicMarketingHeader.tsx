"use client";

import type { ComponentType, CSSProperties, ReactNode } from "react";
import { LayoutDashboard } from "lucide-react";
import { appShellHeader } from "../../tokens/appShellHeader";

export type PublicMarketingHeaderLinkProps = {
  href: string;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  "aria-label"?: string;
  /** Hover outline (estilo sesión); el componente aplica reglas en `<style>`. */
  "data-cmlf-shell"?: string;
};

export type PublicMarketingHeaderProps = {
  /** `next/link` u `<a>`. */
  LinkComponent: ComponentType<PublicMarketingHeaderLinkProps>;
  /** Logo (envolver en `LinkComponent` en el padre si debe ir a home). */
  logo: ReactNode;
  /** Con sesión iniciada: muestra acceso a dashboard **a la izquierda** del control de sesión. */
  showDashboardLink: boolean;
  dashboardHref: string;
  dashboardAriaLabel?: string;
  /** Botón login, form logout, etc. (siempre a la derecha del dashboard si aplica). */
  sessionControl: ReactNode;
  onMenuOpen: () => void;
  menuAriaLabel?: string;
  /** Por defecto `fixed` como landing FotoRank; `sticky` para scroll dentro de un contenedor. */
  position?: "fixed" | "sticky";
  className?: string;
  /**
   * `fotorankDark`: barra oscura + dorado (#D4AF37), default.
   * `comprameLaFotoLight`: barra clara + terracota (#c27b3d) — misma estructura que FotoRank landing.
   */
  variant?: "fotorankDark" | "comprameLaFotoLight";
};

const hit = appShellHeader.circularAction.hitMin;

const headerBarStyle = (
  position: "fixed" | "sticky",
  shell: { background: string; borderBottom: string },
): CSSProperties => ({
  position,
  top: 0,
  left: 0,
  right: 0,
  zIndex: 40,
  width: "100%",
  flexShrink: 0,
  fontFamily: 'system-ui, ui-sans-serif, "DM Sans", sans-serif',
  background: shell.background,
  borderBottom: shell.borderBottom,
  backdropFilter: "blur(12px)",
});

const innerStyle = (maxW: number): CSSProperties => ({
  boxSizing: "border-box",
  maxWidth: maxW,
  marginInline: "auto",
  width: "100%",
  minHeight: "clamp(5.5rem, 12vw, 6.5rem)",
  padding: "0.5rem 1rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
});

const logoZoneStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  minWidth: 0,
  flex: "1 1 auto",
};

const actionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "0.75rem",
  flexShrink: 0,
};

function MenuIcon() {
  return (
    <svg width={20} height={20} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

/**
 * Barra superior para sitios públicos / marketing (ComprameLaFoto, landings).
 * Logo grande a la izquierda; a la derecha: **[Dashboard]** (solo con sesión) → **sesión** → **menú** (dorado FotoRank o terracota ComprameLaFoto).
 *
 * Tokens: `appShellHeader.publicShell` · `appShellHeader.comprameLaFotoPublic` · Doc: `docs/PUBLIC_MARKETING_SHELL.md`
 */
export function PublicMarketingHeader({
  LinkComponent,
  logo,
  showDashboardLink,
  dashboardHref,
  dashboardAriaLabel = "Ir al panel",
  sessionControl,
  onMenuOpen,
  menuAriaLabel = "Abrir menú",
  position = "fixed",
  className,
  variant = "fotorankDark",
}: PublicMarketingHeaderProps) {
  const isCmlf = variant === "comprameLaFotoLight";
  const bar = isCmlf ? appShellHeader.comprameLaFotoPublic : appShellHeader.publicShell;
  const maxW = bar.maxInnerWidthPx;

  const accent = isCmlf
    ? appShellHeader.comprameLaFotoPublic.accent
    : appShellHeader.publicShell.accentGold;
  const accentHover = isCmlf
    ? appShellHeader.comprameLaFotoPublic.accentHover
    : appShellHeader.publicShell.accentGoldHover;
  const menuFg = bar.onAccent;

  const iconCircleOutlineStyle: CSSProperties = {
    boxSizing: "border-box",
    width: hit,
    height: hit,
    minWidth: hit,
    minHeight: hit,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9999,
    border: "none",
    padding: 0,
    margin: 0,
    cursor: "pointer",
    color: accent,
    background: "transparent",
    transition: "color 0.2s ease, background 0.2s ease",
  };

  const menuFillStyle: CSSProperties = {
    ...iconCircleOutlineStyle,
    color: menuFg,
    background: accent,
  };

  const dashboardHoverBg = isCmlf ? "rgba(194, 123, 61, 0.12)" : "rgba(212, 175, 55, 0.12)";

  return (
    <header
      className={className}
      style={headerBarStyle(position, { background: bar.background, borderBottom: bar.borderBottom })}
    >
      <div style={innerStyle(maxW)} className="cmlf-public-header-inner">
        <div style={logoZoneStyle}>{logo}</div>
        <div style={actionsStyle}>
          {showDashboardLink ? (
            <LinkComponent
              href={dashboardHref}
              style={{ ...iconCircleOutlineStyle, textDecoration: "none" }}
              aria-label={dashboardAriaLabel}
              data-cmlf-shell="dashboard-link"
            >
              <LayoutDashboard size={24} strokeWidth={2} aria-hidden />
            </LinkComponent>
          ) : null}
          {sessionControl}
          <button
            type="button"
            onClick={onMenuOpen}
            style={menuFillStyle}
            aria-label={menuAriaLabel}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = accentHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = accent;
            }}
          >
            <MenuIcon />
          </button>
        </div>
      </div>
      <style>{`
        @media (min-width: 768px) {
          .cmlf-public-header-inner { padding: 0.625rem 1.5rem; }
        }
        [data-cmlf-shell="dashboard-link"]:hover {
          background: ${dashboardHoverBg};
          color: ${accentHover};
        }
      `}</style>
    </header>
  );
}
