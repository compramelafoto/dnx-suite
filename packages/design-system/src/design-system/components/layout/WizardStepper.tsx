"use client";

/**
 * Barra de pasos numerada con título corto bajo cada paso y líneas de conexión.
 * Estados: completado, activo, pendiente.
 */

import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import { wizardSpacing } from "../../tokens/wizardSpacing";
import { spacing, fontSize } from "../../tokens";
import { useResolvedTheme, useTheme } from "../../themes";
import { cn } from "../../utils";
import { Text } from "../typography/Text";

export type WizardStepItem = {
  id: string;
  /** Texto corto debajo del número (ej. "Datos", "Fechas"). */
  label: string;
  /** Si está deshabilitado no permite navegación por click. */
  disabled?: boolean;
};

export interface WizardStepperProps {
  steps: WizardStepItem[];
  /** Índice del paso actual (0-based). */
  currentStep: number;
  /** Click opcional sobre pasos (solo si no están disabled). */
  onStepClick?: (index: number, step: WizardStepItem) => void;
  className?: string;
  style?: CSSProperties;
}

function StepCircle({
  index,
  currentStep,
  brandPrimary,
  subtle,
  textMuted,
}: {
  index: number;
  currentStep: number;
  brandPrimary: string;
  subtle: string;
  textMuted: string;
}) {
  const completed = index < currentStep;
  const active = index === currentStep;
  const border = completed || active ? brandPrimary : subtle;

  return (
    <div
      style={{
        flexShrink: 0,
        width: "32px",
        height: "32px",
        borderRadius: "9999px",
        border: `2px solid ${border}`,
        background: completed || active ? brandPrimary : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: fontSize.sm,
        fontWeight: 600,
        color: active || completed ? "#0a0a0a" : textMuted,
        boxShadow: active ? `0 0 0 4px rgba(212, 175, 55, 0.18)` : undefined,
      }}
    >
      {completed ? <Check size={18} strokeWidth={2.5} color="#0a0a0a" aria-hidden /> : <span>{index + 1}</span>}
    </div>
  );
}

export function WizardStepper({ steps, currentStep, onStepClick, className, style }: WizardStepperProps) {
  const theme = useResolvedTheme();
  const brand = useTheme();
  const primary = brand?.primary ?? "#d4af37";
  const lineDone = primary;
  const lineTodo = theme.border.subtle;

  return (
    <nav
      aria-label="Progreso del asistente"
      className={cn(className)}
      style={{
        flexShrink: 0,
        width: "100%",
        paddingTop: wizardSpacing.headerToStepper,
        paddingBottom: wizardSpacing.stepperPaddingY,
        paddingLeft: wizardSpacing.stepperPaddingX,
        paddingRight: wizardSpacing.stepperPaddingX,
        borderBottom: `1px solid ${theme.border.subtle}`,
        boxSizing: "border-box",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          width: "100%",
          alignItems: "flex-start",
        }}
      >
        {steps.map((step, index) => {
          const leftFilled = index > 0 && currentStep >= index;
          const rightFilled = index < steps.length - 1 && currentStep > index;
          const disabled = !!step.disabled;
          const clickable = !disabled && !!onStepClick;

          return (
            <div
              key={step.id}
              aria-current={index === currentStep ? "step" : undefined}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                minWidth: 0,
              }}
            >
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onStepClick?.(index, step)}
                style={{
                  all: "unset",
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  cursor: clickable ? "pointer" : "default",
                  opacity: disabled ? 0.55 : 1,
                }}
                aria-label={`Paso ${index + 1}: ${step.label}${disabled ? " (no disponible)" : ""}`}
              >
                <div
                  style={{
                    flex: 1,
                    height: "2px",
                    borderRadius: "1px",
                    background: index > 0 ? (leftFilled ? lineDone : lineTodo) : "transparent",
                  }}
                  aria-hidden
                />
                <StepCircle
                  index={index}
                  currentStep={currentStep}
                  brandPrimary={primary}
                  subtle={theme.border.default}
                  textMuted={theme.text.tertiary}
                />
                <div
                  style={{
                    flex: 1,
                    height: "2px",
                    borderRadius: "1px",
                    background: index < steps.length - 1 ? (rightFilled ? lineDone : lineTodo) : "transparent",
                  }}
                  aria-hidden
                />
              </button>
              <div style={{ marginTop: spacing[3], width: "100%", paddingLeft: spacing[2], paddingRight: spacing[2] }}>
                <Text
                  variant="helper"
                  as="p"
                  style={{
                    textAlign: "center",
                    color:
                      index === currentStep
                        ? primary
                        : index < currentStep
                          ? theme.text.secondary
                          : theme.text.tertiary,
                    fontWeight: index === currentStep ? 600 : 400,
                  }}
                >
                  {step.label}
                </Text>
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
