"use client";

/**
 * Zona de contenido del paso: scroll interno, ancho máximo centrado.
 * Separa el título/descripción del paso del stepper y del cuerpo del formulario según `wizardSpacing`.
 */

import type { CSSProperties, ReactNode } from "react";
import { wizardSpacing } from "../../tokens/wizardSpacing";
import { useResolvedTheme } from "../../themes";
import { cn } from "../../utils";
import { Text } from "../typography/Text";

export interface WizardContentProps {
  /** Título principal del paso (jerarquía h2). */
  title?: ReactNode;
  /** Descripción; ancho máximo legible. */
  description?: ReactNode;
  children: ReactNode;
  contentMaxWidth?: string;
  descriptionMaxWidth?: string;
  className?: string;
  style?: CSSProperties;
}

export function WizardContent({
  title,
  description,
  children,
  contentMaxWidth = "42rem",
  descriptionMaxWidth = "36rem",
  className,
  style,
}: WizardContentProps) {
  const theme = useResolvedTheme();
  const hasHeading = title != null || description != null;

  return (
    <>
      <div
        className={cn("ds-wizard-content-scroll", className)}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          paddingLeft: wizardSpacing.contentPaddingX,
          paddingRight: wizardSpacing.contentPaddingX,
          paddingTop: hasHeading ? wizardSpacing.stepperToStepTitle : wizardSpacing.contentPaddingY,
          paddingBottom: wizardSpacing.contentPaddingY,
          background: theme.surface.base,
          scrollbarWidth: "thin",
          scrollbarColor: `${theme.border.default} ${theme.surface.base}`,
          ...style,
        }}
      >
        <div
          style={{
            margin: "0 auto",
            width: "100%",
            maxWidth: contentMaxWidth,
          }}
        >
          {title != null && (
            <Text variant="h2" as="h2">
              {title}
            </Text>
          )}
          {description != null && (
            <div
              style={{
                marginTop: title != null ? wizardSpacing.stepTitleToDescription : 0,
                maxWidth: descriptionMaxWidth,
              }}
            >
              <Text variant="muted" as="p">
                {description}
              </Text>
            </div>
          )}
          <div
            style={{
              marginTop: hasHeading ? wizardSpacing.descriptionToFirstBlock : 0,
              display: "flex",
              flexDirection: "column",
              gap: wizardSpacing.betweenSections,
            }}
          >
            {children}
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .ds-wizard-content-scroll::-webkit-scrollbar {
              width: 10px;
              height: 10px;
            }
            .ds-wizard-content-scroll::-webkit-scrollbar-track {
              background: ${theme.surface.base};
            }
            .ds-wizard-content-scroll::-webkit-scrollbar-thumb {
              background: ${theme.border.default};
              border-radius: 9999px;
              border: 2px solid ${theme.surface.base};
            }
            .ds-wizard-content-scroll::-webkit-scrollbar-thumb:hover {
              background: ${theme.border.strong};
            }
          `,
        }}
      />
    </>
  );
}
