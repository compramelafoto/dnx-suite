import { parseDateTimeInput } from "@/lib/admin/datetime-input";
import { CatalogValidationError } from "@/lib/admin-catalog/domain/errors";
import { pesosInputToMinorUnits } from "@/lib/admin-catalog/ui/money-ui";
import {
  findActivePhaseOverlaps,
  validatePricePhaseInput,
} from "@/lib/pricing/domain/resolve-price-phase";
import type { PricePhaseRecord } from "@/lib/pricing/domain/types";

export type PricePhaseFormInput = {
  name: string;
  description: string;
  amountPesos: string;
  currency: string;
  startsAt: string;
  endsAt: string;
  capacity: string;
  priority: string;
  isActive: boolean;
};

export type PricePhaseFormErrors = Partial<Record<keyof PricePhaseFormInput, string>> & {
  _form?: string;
};

export function emptyPricePhaseFormInput(): PricePhaseFormInput {
  return {
    name: "",
    description: "",
    amountPesos: "",
    currency: "ARS",
    startsAt: "",
    endsAt: "",
    capacity: "",
    priority: "100",
    isActive: true,
  };
}

export function pricePhaseFormFromFormData(formData: FormData): PricePhaseFormInput {
  return {
    name: formData.get("name")?.toString() ?? "",
    description: formData.get("description")?.toString() ?? "",
    amountPesos: formData.get("amountPesos")?.toString() ?? "",
    currency: formData.get("currency")?.toString() ?? "ARS",
    startsAt: formData.get("startsAt")?.toString() ?? "",
    endsAt: formData.get("endsAt")?.toString() ?? "",
    capacity: formData.get("capacity")?.toString() ?? "",
    priority: formData.get("priority")?.toString() ?? "100",
    isActive:
      formData.get("isActive") === "on" || formData.get("isActive") === "true",
  };
}

export type ValidatedPricePhase = {
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number | null;
  priority: number;
  isActive: boolean;
};

export function validatePricePhaseForm(
  input: PricePhaseFormInput,
  options: {
    existingPhases: PricePhaseRecord[];
    excludePhaseId?: string;
  },
): { ok: true; data: ValidatedPricePhase } | { ok: false; errors: PricePhaseFormErrors } {
  const errors: PricePhaseFormErrors = {};
  let amountMinor = 0;
  try {
    amountMinor = pesosInputToMinorUnits(input.amountPesos, "amountPesos");
  } catch (err) {
    if (err instanceof CatalogValidationError) {
      Object.assign(errors, err.fieldErrors);
    } else {
      errors.amountPesos = "Importe inválido.";
    }
  }

  const startsAt = parseDateTimeInput(input.startsAt);
  const endsAt = parseDateTimeInput(input.endsAt);
  if (!input.startsAt.trim() || !startsAt) errors.startsAt = "Inicio inválido.";
  if (!input.endsAt.trim() || !endsAt) errors.endsAt = "Fin inválido.";

  let capacity: number | null = null;
  if (input.capacity.trim()) {
    const parsed = Number.parseInt(input.capacity.trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 0 || String(parsed) !== input.capacity.trim()) {
      errors.capacity = "Cupo inválido.";
    } else {
      capacity = parsed;
    }
  }

  const priorityRaw = input.priority.trim() || "100";
  const priority = Number.parseInt(priorityRaw, 10);
  if (!Number.isFinite(priority) || priority < 0 || String(priority) !== priorityRaw) {
    errors.priority = "Prioridad inválida.";
  }

  if (Object.keys(errors).length || !startsAt || !endsAt) {
    return { ok: false, errors };
  }

  const domain = validatePricePhaseInput({
    name: input.name,
    amount: amountMinor,
    currency: (input.currency.trim() || "ARS").toUpperCase(),
    startsAt,
    endsAt,
    capacity,
    priority,
  });
  if (!domain.ok) {
    return { ok: false, errors: domain.errors };
  }

  const candidate: PricePhaseRecord = {
    id: options.excludePhaseId ?? "__new__",
    editionId: "__",
    name: input.name.trim(),
    description: input.description.trim() || null,
    amount: amountMinor,
    currency: (input.currency.trim() || "ARS").toUpperCase(),
    startsAt,
    endsAt,
    capacity,
    priority,
    isActive: Boolean(input.isActive),
  };

  const pool = [
    ...options.existingPhases.filter((p) => p.id !== options.excludePhaseId),
    candidate,
  ];
  const overlaps = findActivePhaseOverlaps(pool);
  if (overlaps.length > 0) {
    return {
      ok: false,
      errors: {
        _form: `La fase se solapa con otra fase activa («${overlaps[0]!.aName}» / «${overlaps[0]!.bName}»).`,
      },
    };
  }

  return {
    ok: true,
    data: {
      name: candidate.name,
      description: candidate.description,
      amount: candidate.amount,
      currency: candidate.currency,
      startsAt,
      endsAt,
      capacity,
      priority,
      isActive: candidate.isActive,
    },
  };
}
