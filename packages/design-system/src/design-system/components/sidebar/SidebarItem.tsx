"use client";

/**
 * Ítem de navegación: icono + etiqueta, estado activo, hover, badge opcional.
 * Por defecto renderiza `<a href>`. En Next.js pasá `LinkComponent={Link}`.
 */

import type { ComponentType, CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { spacing, radius, fontSize } from "../../tokens";
import type { IconName } from "../../icons";
import { useResolvedTheme } from "../../themes";
import { cn } from "../../utils";
import { Icon } from "../ui/Icon";

export type SidebarLinkComponentProps = {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  "aria-current"?: "page" | undefined;
  style?: CSSProperties;
};

export type SidebarLinkComponent = ComponentType<SidebarLinkComponentProps>;

const DefaultSidebarLink: SidebarLinkComponent = function DefaultSidebarLink({
  href,
  className,
  children,
  onClick,
  "aria-current": ariaCurrent,
  style,
}) {
  return (
    <a href={href} className={className} onClick={onClick} aria-current={ariaCurrent} style={style}>
      {children}
    </a>
  );
};

export interface SidebarItemProps {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
  active?: boolean;
  LinkComponent?: SidebarLinkComponent;
  /** Ej. cerrar drawer móvil al navegar. */
  onNavigate?: () => void;
  className?: string;
  style?: CSSProperties;
}

export function SidebarItem({
  href,
  label,
  icon,
  badge,
  active = false,
  LinkComponent = DefaultSidebarLink,
  onNavigate,
  className,
  style,
}: SidebarItemProps) {
  const theme = useResolvedTheme();
  const [hover, setHover] = useState(false);
  const highlight = theme.brand.soft ?? "rgba(255,255,255,0.06)";

  const background = active ? highlight : hover ? theme.state.hover : "transparent";

  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: spacing[3],
    padding: `${spacing[2]} ${spacing[3]}`,
    borderRadius: radius.button,
    color: active ? theme.text.primary : theme.text.secondary,
    background,
    fontSize: fontSize.sm,
    fontWeight: active ? 600 : 500,
    transition: "background 0.15s ease, color 0.15s ease",
    border: active ? `1px solid ${theme.border.subtle}` : "1px solid transparent",
    ...style,
  };

  const Link = LinkComponent;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(className)}
      onClick={() => onNavigate?.()}
      style={{ display: "block", textDecoration: "none", color: "inherit" }}
    >
      <span
        style={rowStyle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <Icon name={icon} size="md" />
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        {badge != null && badge > 0 ? (
          <span
            style={{
              flexShrink: 0,
              minWidth: "1.25rem",
              height: "1.25rem",
              padding: "0 6px",
              borderRadius: radius.pill,
              fontSize: "0.65rem",
              fontWeight: 600,
              lineHeight: "1.25rem",
              textAlign: "center",
              background: theme.surface.elevated,
              color: theme.text.primary,
              border: `1px solid ${theme.border.subtle}`,
            }}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
