"use client";

import { Check, ChevronRight } from "lucide-react";

export interface WizardFooterActionsProps {
  onBack: () => void;
  onPrimary: () => void;
  backDisabled?: boolean;
  primaryDisabled?: boolean;
  primaryLabel: string;
  saving?: boolean;
  isFinalStep?: boolean;
}

/**
 * Acciones alineadas a .fr-btn del design system.
 */
export function WizardFooterActions({
  onBack,
  onPrimary,
  backDisabled,
  primaryDisabled,
  primaryLabel,
  saving,
  isFinalStep,
}: WizardFooterActionsProps) {
  const primaryBlocked = primaryDisabled || saving;

  return (
    <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[#262626] pt-6 sm:mt-10 sm:flex-row sm:items-center sm:justify-between sm:pt-8">
      <button
        type="button"
        onClick={onBack}
        disabled={backDisabled}
        className="fr-btn fr-btn-secondary w-full justify-center sm:w-auto disabled:pointer-events-none disabled:opacity-35"
      >
        Atrás
      </button>
      <button
        type="button"
        onClick={onPrimary}
        disabled={primaryBlocked}
        aria-disabled={primaryBlocked}
        className="fr-btn fr-btn-primary w-full justify-center gap-2 sm:w-auto sm:min-w-[10.5rem] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45"
      >
        {saving ? "Guardando…" : primaryLabel}
        {!saving && isFinalStep ? (
          <Check className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={2.5} aria-hidden />
        ) : !saving ? (
          <ChevronRight className="h-[1.125rem] w-[1.125rem] shrink-0" aria-hidden />
        ) : null}
      </button>
    </div>
  );
}
