"use client";

/**
 * Cabecera del sidebar: marca (logo/slot), nombre del producto, selector de organización opcional.
 */

import type { CSSProperties, ReactNode } from "react";
import { spacing } from "../../tokens";
import { useResolvedTheme } from "../../themes";
import { cn } from "../../utils";
import { Text } from "../typography/Text";

export interface SidebarHeaderProps {
  brand?: ReactNode;
  productName: ReactNode;
  organizationSelector?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function SidebarHeader({ brand, productName, organizationSelector, className, style }: SidebarHeaderProps) {
  const theme = useResolvedTheme();

  return (
    <header
      className={cn(className)}
      style={{
        flexShrink: 0,
        paddingLeft: spacing[4],
        paddingRight: spacing[4],
        paddingTop: spacing[4],
        paddingBottom: spacing[6],
        marginBottom: spacing[2],
        borderBottom: `1px solid ${theme.border.subtle}`,
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: spacing[3], minWidth: 0 }}>
        {brand != null ? (
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{brand}</div>
        ) : null}
        <div style={{ minWidth: 0, flex: 1 }}>
          <Text variant="h3" as="div" style={{ fontSize: "1rem", fontWeight: 600 }}>
            {productName}
          </Text>
        </div>
      </div>
      {organizationSelector != null ? (
        <div style={{ marginTop: spacing[4] }}>{organizationSelector}</div>
      ) : null}
    </header>
  );
}
