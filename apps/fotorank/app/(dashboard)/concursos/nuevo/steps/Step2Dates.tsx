"use client";

import type { WizardData } from "../CreateContestWizard";
import { DateTimeInput } from "../../../../components/ui/DateTimeInput";

interface Step2DatesProps {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
}

const FIELDS = [
  { id: "startAt", label: "Inicio del concurso", key: "startAt" as const },
  { id: "submissionDeadline", label: "Cierre de inscripciones", key: "submissionDeadline" as const },
  { id: "judgingStartAt", label: "Inicio de evaluación", key: "judgingStartAt" as const },
  { id: "judgingEndAt", label: "Fin de evaluación", key: "judgingEndAt" as const },
  { id: "resultsAt", label: "Publicación de resultados", key: "resultsAt" as const },
] as const;

export function Step2Dates({ data, updateData }: Step2DatesProps) {
  return (
    <div className="flex w-full max-w-[320px] flex-col gap-y-6">
      {FIELDS.map(({ id, label, key }) => (
        <div key={id} className="space-y-2">
          <label htmlFor={id} className="block text-sm font-medium text-fr-muted">
            {label}
          </label>
          <DateTimeInput
            id={id}
            label={label}
            value={data[key]}
            onChange={(v) => updateData({ [key]: v })}
            variant="wizard"
            compact
            placeholder="Seleccionar"
          />
        </div>
      ))}
    </div>
  );
}
