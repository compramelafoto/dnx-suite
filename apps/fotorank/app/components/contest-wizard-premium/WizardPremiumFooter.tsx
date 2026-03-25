"use client";

import { Button, Icon } from "@repo/design-system";

export interface WizardPremiumFooterProps {
  onBack: () => void;
  onPrimary: () => void;
  /** Cierra el asistente sin guardar paso adicional */
  onCancel?: () => void;
  backDisabled?: boolean;
  primaryDisabled?: boolean;
  primaryLabel: string;
  saving?: boolean;
  showArrow?: boolean;
}

/**
 * Footer del wizard: cancelar a la izquierda, navegación a la derecha.
 */
export function WizardPremiumFooter({
  onBack,
  onPrimary,
  onCancel,
  backDisabled,
  primaryDisabled,
  primaryLabel,
  saving,
  showArrow = true,
}: WizardPremiumFooterProps) {
  const blocked = primaryDisabled || saving;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="order-2 sm:order-1">
        {onCancel ? (
          <Button type="button" variant="ghost" size="md" onClick={onCancel} className="w-full sm:w-auto">
            Cancelar
          </Button>
        ) : null}
      </div>

      <div className="order-1 flex flex-col-reverse gap-3 sm:order-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={onBack}
          disabled={backDisabled}
          className="w-full sm:w-auto sm:min-w-[7rem]"
          aria-label={backDisabled ? "Atrás no disponible en el primer paso" : "Ir al paso anterior"}
        >
          <span className="inline-flex items-center justify-center gap-2">
            <Icon name="arrowBack" size="sm" aria-hidden />
            Atrás
          </span>
        </Button>

        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={onPrimary}
          disabled={blocked}
          className="w-full sm:w-auto sm:min-w-[13rem]"
          aria-busy={saving ? true : undefined}
        >
          <span className="inline-flex items-center justify-center gap-2">
            {saving ? "Guardando…" : primaryLabel}
            {!saving && showArrow ? <Icon name="breadcrumb" size="md" aria-hidden /> : null}
          </span>
        </Button>
      </div>
    </div>
  );
}
