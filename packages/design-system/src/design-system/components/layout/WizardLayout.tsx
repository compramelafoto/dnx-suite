"use client";

/**
 * WizardLayout — plantilla premium para wizards (Fotorank / plataforma).
 *
 * API integrada:
 * - `brand`, `organizationName`, `onClose`
 * - `steps` + `currentStep` para el stepper
 * - Título y descripción del paso: **`title`** y **`description`** (preferido), o `stepTitle` / `stepDescription` (alias retrocompatibles)
 * - `footerLeft` / `footerRight`: Cancelar a la izquierda; Atrás / Siguiente / Guardar a la derecha
 * - `children`: cuerpo del paso (`WizardSection`, `WizardField`, …)
 *
 * Composición manual: `WizardHeader`, `WizardStepper`, `WizardContent`, `WizardFooter` o `WizardFrame`.
 *
 * Scroll: solo `WizardContent` hace scroll; header, stepper y footer permanecen visibles.
 */

import type { CSSProperties, ReactNode } from "react";
import { cn } from "../../utils";
import { WizardHeader } from "./WizardHeader";
import { WizardStepper, type WizardStepItem } from "./WizardStepper";
import { WizardContent } from "./WizardContent";
import { WizardFooter } from "./WizardFooter";

export type { WizardStepItem };

export interface WizardLayoutProps {
  /** Logo o marca (texto, imagen, lockup). */
  brand?: ReactNode;
  /** Nombre de organización (zona secundaria bajo la marca). */
  organizationName?: string;
  steps: WizardStepItem[];
  /** Índice del paso actual (0-based). */
  currentStep: number;
  /** Habilita navegación por click en el stepper (si el paso no está disabled). */
  onStepClick?: (index: number, step: WizardStepItem) => void;
  /** Título principal del paso actual (preferido). Alias: `stepTitle`. */
  title?: ReactNode;
  /** Descripción del paso; ancho máximo legible vía `descriptionMaxWidth`. Alias: `stepDescription`. */
  description?: ReactNode;
  /** @deprecated Preferir `title`. */
  stepTitle?: ReactNode;
  /** @deprecated Preferir `description`. */
  stepDescription?: ReactNode;
  onClose: () => void;
  /** Acciones izquierda del pie (p. ej. Cancelar). */
  footerLeft?: ReactNode;
  /** Acciones derecha del pie (Atrás, Siguiente, Guardar). */
  footerRight?: ReactNode;
  children: ReactNode;
  contentMaxWidth?: string;
  descriptionMaxWidth?: string;
  className?: string;
  style?: CSSProperties;
}

export function WizardLayout({
  brand,
  organizationName,
  steps,
  currentStep,
  onStepClick,
  title,
  description,
  stepTitle,
  stepDescription,
  onClose,
  footerLeft,
  footerRight,
  children,
  contentMaxWidth,
  descriptionMaxWidth,
  className,
  style,
}: WizardLayoutProps) {
  const resolvedTitle = title ?? stepTitle;
  const resolvedDescription = description ?? stepDescription;

  return (
    <div
      className={cn(className)}
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        height: "100%",
        ...style,
      }}
    >
      <WizardHeader brand={brand} organizationName={organizationName} onClose={onClose} />
      <WizardStepper steps={steps} currentStep={currentStep} onStepClick={onStepClick} />
      <WizardContent
        title={resolvedTitle}
        description={resolvedDescription}
        contentMaxWidth={contentMaxWidth}
        descriptionMaxWidth={descriptionMaxWidth}
      >
        {children}
      </WizardContent>
      <WizardFooter left={footerLeft} right={footerRight} />
    </div>
  );
}
