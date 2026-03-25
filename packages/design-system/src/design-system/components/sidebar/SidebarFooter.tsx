"use client";

/**
 * Pie del sidebar: usuario actual, acceso a configuración y cierre de sesión.
 * Los botones son opcionales; la app conecta handlers (router, signOut, etc.).
 */

import type { CSSProperties, ReactNode } from "react";
import { spacing, radius, fontSize } from "../../tokens";
import { useResolvedTheme } from "../../themes";
import { cn } from "../../utils";
import { Text } from "../typography/Text";
import { Icon } from "../ui/Icon";

export interface SidebarFooterProps {
  userName: ReactNode;
  userEmail?: ReactNode;
  avatar?: ReactNode;
  onSettings?: () => void;
  onLogout?: () => void;
  settingsLabel?: string;
  logoutLabel?: string;
  className?: string;
  style?: CSSProperties;
}

export function SidebarFooter({
  userName,
  userEmail,
  avatar,
  onSettings,
  onLogout,
  settingsLabel = "Configuración",
  logoutLabel = "Cerrar sesión",
  className,
  style,
}: SidebarFooterProps) {
  const theme = useResolvedTheme();

  return (
    <footer
      className={cn(className)}
      style={{
        flexShrink: 0,
        marginTop: "auto",
        paddingLeft: spacing[4],
        paddingRight: spacing[4],
        paddingBottom: spacing[4],
        paddingTop: spacing[4],
        borderTop: `1px solid ${theme.border.subtle}`,
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing[3],
          marginBottom: spacing[3],
          minWidth: 0,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.button,
            background: theme.surface.elevated,
            border: `1px solid ${theme.border.subtle}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            overflow: "hidden",
            color: theme.text.secondary,
          }}
        >
          {avatar ?? <Icon name="user" size="md" />}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Text variant="body" as="div" style={{ fontWeight: 600, fontSize: fontSize.sm }}>
            {userName}
          </Text>
          {userEmail != null ? (
            <Text variant="helper" as="div" style={{ marginTop: 2 }}>
              {userEmail}
            </Text>
          ) : null}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: spacing[2], flexWrap: "wrap" }}>
        {onSettings ? (
          <button
            type="button"
            onClick={onSettings}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: spacing[2],
              padding: `${spacing[2]} ${spacing[3]}`,
              borderRadius: radius.button,
              border: `1px solid ${theme.border.subtle}`,
              background: theme.surface.elevated,
              color: theme.text.secondary,
              fontSize: fontSize.sm,
              cursor: "pointer",
            }}
          >
            {settingsLabel}
          </button>
        ) : null}
        {onLogout ? (
          <button
            type="button"
            onClick={onLogout}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: spacing[2],
              padding: `${spacing[2]} ${spacing[3]}`,
              borderRadius: radius.button,
              border: `1px solid ${theme.border.subtle}`,
              background: "transparent",
              color: theme.text.secondary,
              fontSize: fontSize.sm,
              cursor: "pointer",
            }}
          >
            {logoutLabel}
          </button>
        ) : null}
      </div>
    </footer>
  );
}
