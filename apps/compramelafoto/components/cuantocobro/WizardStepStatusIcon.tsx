"use client";

import {
  CUANTO_COBRO_STEP_VALIDATION_LABELS,
  type CuantoCobroStepValidationStatus,
} from "@/lib/cuantocobro/step-validation";
import { AlertCircle, Check, X } from "lucide-react";

type Props = {
  status: CuantoCobroStepValidationStatus;
  className?: string;
};

export default function WizardStepStatusIcon({ status, className = "" }: Props) {
  const label = CUANTO_COBRO_STEP_VALIDATION_LABELS[status];

  if (status === "complete") {
    return (
      <span className={className} aria-label={label} title={label}>
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className={className} aria-label={label} title={label}>
        <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      </span>
    );
  }

  return (
    <span className={className} aria-label={label} title={label}>
      <AlertCircle className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
    </span>
  );
}
