"use client";

/**
 * Layout de aplicación: sidebar a la izquierda, contenido principal a la derecha.
 * En viewport estrecho el sidebar pasa a drawer superpuesto; controlá `mobileSidebarOpen` desde el header (menú hamburguesa).
 * Requiere `DesignSystemProvider` para tema / dark mode.
 */

import type { CSSProperties, ReactNode } from "react";
import { useResolvedTheme } from "../../themes";
import { useMediaQuery, cn } from "../../utils";
import { SIDEBAR_MOBILE_MEDIA, SIDEBAR_WIDTH_PX } from "./constants";

export interface AppLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  /** Barra superior opcional (full width, encima del área flex). */
  header?: ReactNode;
  /** Estado drawer móvil (solo aplica bajo breakpoint). */
  mobileSidebarOpen?: boolean;
  onMobileSidebarClose?: () => void;
  /** Escritorio: si es `false`, el panel lateral se colapsa (ancho 0) con transición. */
  desktopSidebarExpanded?: boolean;
  sidebarWidth?: number;
  /**
   * Cuando el header es fijo o sticky en viewport, desplazar el drawer lateral móvil
   * hacia abajo para que no quede tapado (p. ej. `"6.5rem"` o `"104px"`).
   */
  sidebarViewportTop?: string;
  className?: string;
  style?: CSSProperties;
}

export function AppLayout({
  sidebar,
  children,
  header,
  mobileSidebarOpen = false,
  onMobileSidebarClose,
  desktopSidebarExpanded = true,
  sidebarWidth = SIDEBAR_WIDTH_PX,
  sidebarViewportTop,
  className,
  style,
}: AppLayoutProps) {
  const theme = useResolvedTheme();
  const isMobile = useMediaQuery(SIDEBAR_MOBILE_MEDIA);
  const showDrawer = isMobile && mobileSidebarOpen;

  return (
    <div
      className={cn(className)}
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: theme.background.primary,
        color: theme.text.primary,
        ...style,
      }}
    >
      {header != null ? <div style={{ flexShrink: 0 }}>{header}</div> : null}

      <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>
        {isMobile && showDrawer && onMobileSidebarClose ? (
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={onMobileSidebarClose}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 40,
              border: "none",
              padding: 0,
              margin: 0,
              background: "rgba(0,0,0,0.55)",
              cursor: "pointer",
            }}
          />
        ) : null}

        <div
          style={
            isMobile
              ? {
                  position: "fixed",
                  top: sidebarViewportTop ?? 0,
                  left: 0,
                  bottom: 0,
                  zIndex: 50,
                  width: sidebarWidth,
                  transform: showDrawer ? "translateX(0)" : "translateX(-100%)",
                  transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxShadow: showDrawer ? "8px 0 24px rgba(0,0,0,0.35)" : undefined,
                }
              : {
                  flexShrink: 0,
                  width: desktopSidebarExpanded ? sidebarWidth : 0,
                  minWidth: 0,
                  overflow: "hidden",
                  pointerEvents: desktopSidebarExpanded ? "auto" : "none",
                  transition: "width 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
                }
          }
        >
          {sidebar}
        </div>

        <main
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            overflow: "auto",
            background: theme.background.primary,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
