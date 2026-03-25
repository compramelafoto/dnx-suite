"use client";

/**
 * Intro de diálogo: branding opcional (logo), título, subtítulo y slot para contenido.
 * Ritmo vertical alineado con `compositionSpacing.modalBrand` (logo → título → subtítulo → contenido).
 * El logo solo debe usarse en contextos de marca (onboarding, bienvenida); no en modales puramente funcionales.
 */

import type { CSSProperties, ReactNode } from "react";
import { compositionSpacing } from "../../tokens";
import { cn } from "../../utils";
import { Text } from "../typography/Text";

export interface DialogIntroProps {
  branding?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  align?: "center" | "start";
  className?: string;
  style?: CSSProperties;
}

export function DialogIntro({
  branding,
  title,
  subtitle,
  children,
  align = "center",
  className,
  style,
}: DialogIntroProps) {
  const isCenter = align === "center";

  return (
    <div
      className={cn(className)}
      style={{
        textAlign: isCenter ? "center" : "left",
        ...style,
      }}
    >
      {branding != null ? (
        <div
          style={{
            marginBottom: compositionSpacing.modalBrand.logoToTitle,
            display: "flex",
            justifyContent: isCenter ? "center" : "flex-start",
          }}
        >
          {branding}
        </div>
      ) : null}
      {title != null ? (
        <Text variant="h2" as="h2" style={{ textAlign: isCenter ? "center" : "left" }}>
          {title}
        </Text>
      ) : null}
      {subtitle != null ? (
        <div
          style={{
            marginTop: title != null ? compositionSpacing.modalBrand.titleToSubtitle : 0,
          }}
        >
          <Text variant="muted" as="p" style={{ textAlign: isCenter ? "center" : "left" }}>
            {subtitle}
          </Text>
        </div>
      ) : null}
      {children != null ? (
        <div style={{ marginTop: compositionSpacing.modalBrand.subtitleToActions }}>{children}</div>
      ) : null}
    </div>
  );
}
