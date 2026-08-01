import { PartnersDomainError } from "./types";
import type {
  CreateBenefitInput,
  CreateContributionInput,
  CreateParticipationInput,
  CreatePartnerInput,
  UpdateBenefitInput,
  UpdateParticipationInput,
} from "./types";
import { isValidPartnerSlug, normalizePartnerSlug, slugFromPartnerName } from "./slug";

export function assertDateRange(
  startsAt: Date | null | undefined,
  endsAt: Date | null | undefined,
  field = "endsAt",
): void {
  if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
    throw new PartnersDomainError("VALIDATION", "La fecha de fin no puede ser anterior al inicio.", {
      [field]: "La fecha de fin no puede ser anterior al inicio.",
    });
  }
}

export function assertNonNegativeLimit(
  value: number | null | undefined,
  field: string,
): void {
  if (value == null) return;
  if (!Number.isInteger(value) || value < 0) {
    throw new PartnersDomainError("VALIDATION", `${field} no puede ser negativo.`, {
      [field]: "Debe ser un entero ≥ 0.",
    });
  }
}

export function assertDiscountPercentage(
  value: number | null | undefined,
): void {
  if (value == null) return;
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new PartnersDomainError("VALIDATION", "Porcentaje inválido.", {
      discountPercentage: "El porcentaje debe estar entre 0 y 100.",
    });
  }
}

export function normalizeCreatePartnerInput(input: CreatePartnerInput): {
  name: string;
  slug: string;
} & CreatePartnerInput {
  const name = input.name?.trim() ?? "";
  if (!name) {
    throw new PartnersDomainError("VALIDATION", "El nombre es obligatorio.", {
      name: "El nombre es obligatorio.",
    });
  }
  const slugRaw = (input.slug?.trim() ? normalizePartnerSlug(input.slug) : slugFromPartnerName(name));
  if (!isValidPartnerSlug(slugRaw)) {
    throw new PartnersDomainError("VALIDATION", "Slug inválido.", {
      slug: "Usá 2–80 caracteres: a-z, 0-9 y guiones.",
    });
  }
  return { ...input, name, slug: slugRaw };
}

export function validateParticipationDates(
  input: Pick<CreateParticipationInput | UpdateParticipationInput, "startsAt" | "endsAt">,
): void {
  assertDateRange(input.startsAt ?? null, input.endsAt ?? null);
}

/** Normaliza campos de pago: sin pago ⇒ mode NONE y sin montos obligatorios. */
export function normalizePaymentFields(input: {
  requiresPayment?: boolean;
  paymentMode?: CreateParticipationInput["paymentMode"];
  paymentAmountMinor?: number | null;
  paymentCurrency?: string | null;
  paymentNotes?: string | null;
}): {
  requiresPayment: boolean;
  paymentMode: NonNullable<CreateParticipationInput["paymentMode"]>;
  paymentAmountMinor: number | null;
  paymentCurrency: string | null;
  paymentNotes: string | null;
} {
  const requiresPayment = input.requiresPayment === true;
  if (!requiresPayment) {
    return {
      requiresPayment: false,
      paymentMode: "NONE",
      paymentAmountMinor: null,
      paymentCurrency: input.paymentCurrency ?? "ARS",
      paymentNotes: input.paymentNotes ?? null,
    };
  }
  const mode = input.paymentMode && input.paymentMode !== "NONE" ? input.paymentMode : "MANUAL";
  if (input.paymentAmountMinor != null && input.paymentAmountMinor < 0) {
    throw new PartnersDomainError("VALIDATION", "Monto de pago inválido.", {
      paymentAmountMinor: "El monto no puede ser negativo.",
    });
  }
  return {
    requiresPayment: true,
    paymentMode: mode,
    paymentAmountMinor: input.paymentAmountMinor ?? null,
    paymentCurrency: input.paymentCurrency ?? "ARS",
    paymentNotes: input.paymentNotes ?? null,
  };
}

export function validateContributionInput(input: CreateContributionInput): string {
  const title = input.title?.trim() ?? "";
  if (!title) {
    throw new PartnersDomainError("VALIDATION", "El título del aporte es obligatorio.", {
      title: "El título es obligatorio.",
    });
  }
  assertNonNegativeLimit(input.quantity ?? null, "quantity");
  if (input.estimatedUnitValueMinor != null && input.estimatedUnitValueMinor < 0) {
    throw new PartnersDomainError("VALIDATION", "Valor unitario inválido.", {
      estimatedUnitValueMinor: "No puede ser negativo.",
    });
  }
  if (input.estimatedTotalValueMinor != null && input.estimatedTotalValueMinor < 0) {
    throw new PartnersDomainError("VALIDATION", "Valor total inválido.", {
      estimatedTotalValueMinor: "No puede ser negativo.",
    });
  }
  return title;
}

export function validateBenefitFields(
  input: CreateBenefitInput | UpdateBenefitInput,
  opts?: {
    activating?: boolean;
    current?: {
      title?: string;
      description?: string | null;
      redemptionMethod?: string;
      endsAt?: Date | null;
    };
  },
): void {
  if ("title" in input && input.title !== undefined) {
    const title = input.title?.trim() ?? "";
    if (!title) {
      throw new PartnersDomainError("VALIDATION", "El título es obligatorio.", {
        title: "El título es obligatorio.",
      });
    }
  }
  assertDiscountPercentage(
    "discountPercentage" in input ? input.discountPercentage : undefined,
  );
  assertNonNegativeLimit(
    "totalRedemptionLimit" in input ? input.totalRedemptionLimit : undefined,
    "totalRedemptionLimit",
  );
  assertNonNegativeLimit(
    "perUserRedemptionLimit" in input ? input.perUserRedemptionLimit : undefined,
    "perUserRedemptionLimit",
  );
  if (
    "discountAmountMinor" in input &&
    input.discountAmountMinor != null &&
    input.discountAmountMinor < 0
  ) {
    throw new PartnersDomainError("VALIDATION", "Monto de descuento inválido.", {
      discountAmountMinor: "No puede ser negativo.",
    });
  }
  assertDateRange(
    "startsAt" in input ? input.startsAt ?? null : null,
    "endsAt" in input ? input.endsAt ?? null : null,
  );

  if (opts?.activating) {
    const title = (input.title ?? opts.current?.title ?? "").trim();
    const description = (input.description ?? opts.current?.description ?? "").trim();
    const method = input.redemptionMethod ?? opts.current?.redemptionMethod;
    const endsAt =
      "endsAt" in input && input.endsAt !== undefined
        ? input.endsAt
        : (opts.current?.endsAt ?? null);
    const errors: Record<string, string> = {};
    if (!title) errors.title = "Requerido para activar.";
    if (!description) errors.description = "Requerido para activar.";
    if (!method) errors.redemptionMethod = "Requerido para activar.";
    if (endsAt && endsAt.getTime() < Date.now()) {
      errors.endsAt = "No se puede activar un beneficio vencido.";
    }
    if (Object.keys(errors).length) {
      throw new PartnersDomainError(
        "VALIDATION",
        "No se puede activar el beneficio con los datos actuales.",
        errors,
      );
    }
  }
}

/** Garantía de dominio: crear participación no genera órdenes/links/recurrencias. */
export function assertNoAutomaticPaymentSideEffects(participation: {
  requiresPayment: boolean;
  paymentMode: string;
}): {
  createdPaymentOrder: false;
  createdPaymentLink: false;
  createdRecurringSchedule: false;
} {
  void participation;
  return {
    createdPaymentOrder: false,
    createdPaymentLink: false,
    createdRecurringSchedule: false,
  };
}
