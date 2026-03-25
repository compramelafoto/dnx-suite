"use client";

/**
 * Cabecera del wizard: marca opcional, nombre de organización (secundario), cierre.
 * Pensado para dark mode y estética premium (Fotorank); usa solo tokens y tema.
 */

import type { CSSProperties, ReactNode } from "react";
import { wizardSpacing } from "../../tokens/wizardSpacing";
import { spacing } from "../../tokens";
import { useResolvedTheme } from "../../themes";
import { cn } from "../../utils";
import { Text } from "../typography/Text";

export interface WizardHeaderProps {
  /** Logo o marca (ej. texto “FotoRank”, imagen, lockup). */
  brand?: ReactNode;
  /** Nombre de la organización; estilo secundario bajo la marca. */
  organizationName?: string;
  onClose: () => void;
  className?: string;
  style?: CSSProperties;
}

export function WizardHeader({ brand, organizationName, onClose, className, style }: WizardHeaderProps) {
  const theme = useResolvedTheme();

  return (
    <header
      className={cn(className)}
      style={{
        flexShrink: 0,
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        gap: spacing[4],
        padding: wizardSpacing.headerPadding,
        borderBottom: `1px solid ${theme.border.subtle}`,
        minHeight: "56px",
        boxSizing: "border-box",
        ...style,
      }}
    >
      <span aria-hidden style={{ width: spacing[8] }} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing[2],
          textAlign: "center",
          minWidth: 0,
        }}
      >
        {brand != null ? <div style={{ maxWidth: "100%" }}>{brand}</div> : null}
        {organizationName != null && organizationName !== "" ? (
          <Text variant="muted" as="p">
            {organizationName}
          </Text>
        ) : null}
      </div>
      <div style={{ justifySelf: "end" }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar asistente"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            border: `1px solid ${theme.border.subtle}`,
            background: theme.state.hover,
            color: theme.text.secondary,
            cursor: "pointer",
            fontSize: "1.25rem",
            lineHeight: 1,
            transition: "background 0.15s ease, color 0.15s ease",
          }}
        >
          ×
        </button>
      </div>
    </header>
  );
}
