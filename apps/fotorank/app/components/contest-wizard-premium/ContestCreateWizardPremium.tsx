"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Text, WizardLayout, WizardSection, type WizardStepItem, spacing } from "@repo/design-system";
import { WizardModalPremium } from "./WizardModalPremium";

export type ContestWizardStepDefinition = {
  id: number;
  label: string;
};

const DEFAULT_STEPS: ContestWizardStepDefinition[] = [
  { id: 1, label: "Datos generales" },
  { id: 2, label: "Fechas" },
  { id: 3, label: "Configuración" },
  { id: 4, label: "Categorías" },
];

export interface ContestCreateWizardPremiumProps {
  isOpen: boolean;
  onClose: () => void;
  /** Paso actual (1-based). */
  currentStep: number;
  headline: string;
  intro: string;
  steps?: readonly ContestWizardStepDefinition[];
  onStepClick?: (stepId: number) => void;
  /** Máximo paso alcanzado en el flujo (1-based). */
  maxStepReached?: number;
  statusLine?: ReactNode;
  children: ReactNode;
  /** Footer legacy completo (se renderiza a la derecha). */
  footer: ReactNode;
  organizationName?: string;
}

/**
 * Composición lista para usar del wizard de alta.
 * Adopta la base del design system (`WizardLayout`) y mantiene compatibilidad con el flujo actual.
 */
export function ContestCreateWizardPremium({
  isOpen,
  onClose,
  currentStep,
  headline,
  intro,
  steps = DEFAULT_STEPS,
  onStepClick,
  maxStepReached = steps.length,
  statusLine,
  children,
  footer,
  organizationName,
}: ContestCreateWizardPremiumProps) {
  const currentIndex = Math.max(0, currentStep - 1);

  const dsSteps: WizardStepItem[] = steps.map((step) => ({
    id: String(step.id),
    label: step.label,
    disabled: step.id > maxStepReached,
  }));

  return (
    <WizardModalPremium isOpen={isOpen} onClose={onClose}>
      <WizardLayout
        brand={
          <Link href="/dashboard" aria-label="FotoRank — ir al panel" style={{ display: "inline-flex", outline: "none" }}>
            <Image
              src="/fotorank-logo.png"
              alt="FotoRank"
              width={864}
              height={288}
              className="h-16 w-auto sm:h-20"
              priority
            />
          </Link>
        }
        organizationName={organizationName}
        steps={dsSteps}
        currentStep={currentIndex}
        onStepClick={(index) => onStepClick?.(steps[index]?.id ?? index + 1)}
        title={headline}
        description={intro}
        onClose={onClose}
        footerRight={footer}
        contentMaxWidth="45rem"
      >
        {statusLine ? (
          <WizardSection title="Estado" description={typeof statusLine === "string" ? statusLine : undefined}>
            {typeof statusLine === "string" ? null : (
              <Text variant="helper" as="div" style={{ paddingTop: spacing[1] }}>
                {statusLine}
              </Text>
            )}
          </WizardSection>
        ) : null}
        {children}
      </WizardLayout>
    </WizardModalPremium>
  );
}

export { ContestWizardStepOnePremium } from "./ContestWizardStepOnePremium";
export { WizardPremiumFooter } from "./WizardPremiumFooter";
export { WizardModalPremium } from "./WizardModalPremium";
export { ContestWizardStepperPremium } from "./ContestWizardStepperPremium";
export { WizardSectionCardPremium } from "./WizardSectionCardPremium";
export {
  WizardPremiumFormField,
  wizardPremiumInputClass,
  wizardPremiumTextareaClass,
} from "./WizardPremiumFormField";
export { WizardPremiumUploadZone } from "./WizardPremiumUploadZone";
export { ContestWizardProgressBlock } from "./ContestWizardProgressBlock";
