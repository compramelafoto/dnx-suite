import type { EffectiveBenefitAccess } from "./eligibility-types";
import type { BenefitAccessRecord, BenefitRecord } from "./types";

export function canUserAccessBenefit(input: {
  benefit: BenefitRecord;
  accesses: BenefitAccessRecord[];
  userId: number;
  now?: Date;
}): EffectiveBenefitAccess {
  const now = input.now ?? new Date();
  const active = input.accesses.filter(
    (a) => a.userId === input.userId && a.status === "ACTIVE",
  );
  const benefitOk =
    input.benefit.status === "ACTIVE" &&
    !input.benefit.archivedAt &&
    (!input.benefit.startsAt || input.benefit.startsAt.getTime() <= now.getTime()) &&
    (!input.benefit.endsAt || input.benefit.endsAt.getTime() >= now.getTime());

  const hasAccess = benefitOk && active.length > 0;
  const sources = [...new Set(active.map((a) => a.source))];
  const reasonCodes = active.map((a) => a.reasonCode).filter(Boolean) as string[];

  let explanation = "Sin acceso materializado.";
  if (!benefitOk) explanation = "Beneficio no vigente o no activo.";
  else if (hasAccess) {
    explanation = `Acceso activo (${sources.join("+")}).`;
  } else if (input.accesses.some((a) => a.userId === input.userId && a.status === "REVOKED")) {
    explanation = "Acceso revocado.";
  }

  return {
    benefitId: input.benefit.id,
    userId: input.userId,
    hasAccess,
    sources,
    explanation,
    reasonCodes,
  };
}

export function listAccessibleBenefitsForUser(input: {
  benefits: BenefitRecord[];
  accessesByBenefitId: Map<string, BenefitAccessRecord[]>;
  userId: number;
  now?: Date;
}): EffectiveBenefitAccess[] {
  return input.benefits
    .map((benefit) =>
      canUserAccessBenefit({
        benefit,
        accesses: input.accessesByBenefitId.get(benefit.id) ?? [],
        userId: input.userId,
        now: input.now,
      }),
    )
    .filter((r) => r.hasAccess);
}

/** Alias canónico de explicación de acceso efectivo. */
export function getBenefitAccessExplanation(input: {
  benefit: BenefitRecord;
  accesses: BenefitAccessRecord[];
  userId: number;
  now?: Date;
}): EffectiveBenefitAccess {
  return canUserAccessBenefit(input);
}
