"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CLICKATON_AUDIENCE_OPTIONS,
  CLICKATON_PARTICIPATION_ROLE_OPTIONS,
  DNX_PARTNER_BENEFIT_TYPES,
  DNX_PARTNER_CONTRIBUTION_TYPES,
  DNX_PARTNER_DISPLAY_TIERS,
  DNX_PARTNER_INSTITUTIONAL_ROLES,
  DNX_PARTNER_PARTICIPATION_STATUSES,
  DNX_PARTNER_PAYMENT_MODES,
  DNX_PARTNER_REDEMPTION_METHODS,
  PartnersDomainError,
  type DnxPartnerBenefitType,
  type DnxPartnerContributionType,
  type DnxPartnerDisplayTier,
  type DnxPartnerInstitutionalRole,
  type DnxPartnerParticipationStatus,
  type DnxPartnerPaymentMode,
  type DnxPartnerRedemptionMethod,
} from "@repo/partners";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { parseDateTimeInput } from "@/lib/admin/datetime-input";
import { withClickatonDb } from "@/lib/admin/db";
import { getClickatonPartnersService, toPartnerActor } from "@/lib/admin/partners/runtime";
import {
  activateEditionBenefit,
  archiveEditionBenefit,
  archiveEditionPartnerParticipation,
  createEditionPartnerBenefit,
  createEditionPartnerContribution,
  createEditionPartnerParticipation,
  grantEditionBenefitManually,
  linkContributionToPrize,
  pauseEditionBenefit,
  revokeEditionBenefitGrant,
  updateEditionPartnerParticipation,
} from "./service";

function editionSponsorsPath(editionId: string, participationId?: string) {
  const base = `${adminRoutes.editions}/${editionId}/sponsors`;
  return participationId ? `${base}/${participationId}` : base;
}

function revalidateEditionPartners(editionId: string, participationId?: string) {
  revalidatePath(editionSponsorsPath(editionId));
  if (participationId) revalidatePath(editionSponsorsPath(editionId, participationId));
  revalidatePath(adminRoutes.sponsors);
}

function asEnum<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function optionalInt(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

const ROLE_VALUES = CLICKATON_PARTICIPATION_ROLE_OPTIONS.map((o) => o.value);

export async function createEditionParticipationFormAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const editionId = formData.get("editionId")?.toString() ?? "";
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  const requiresPayment = formData.get("requiresPayment") === "true";
  const role = asEnum(
    formData.get("role")?.toString() ?? "SPONSOR",
    ROLE_VALUES,
    "SPONSOR",
  );
  const institutionalRole = asEnum(
    formData.get("institutionalRole")?.toString() ?? "SPONSOR",
    DNX_PARTNER_INSTITUTIONAL_ROLES,
    "SPONSOR",
  ) as DnxPartnerInstitutionalRole;
  const displayTier = asEnum(
    formData.get("displayTier")?.toString() ?? "STANDARD",
    DNX_PARTNER_DISPLAY_TIERS,
    "STANDARD",
  ) as DnxPartnerDisplayTier;

  try {
    const result = await withClickatonDb(async () =>
      createEditionPartnerParticipation(actor, editionId, {
        partnerId,
        role,
        institutionalRole,
        displayTier,
        displayOrder: optionalInt(formData.get("displayOrder")?.toString() ?? "") ?? 100,
        publicRoleLabel: formData.get("publicRoleLabel")?.toString()?.trim() || null,
        destinationUrl: formData.get("destinationUrl")?.toString()?.trim() || null,
        clickTrackingEnabled: formData.get("clickTrackingEnabled") !== "false",
        title: formData.get("title")?.toString()?.trim() || null,
        description: formData.get("description")?.toString()?.trim() || null,
        status: asEnum(
          formData.get("status")?.toString() ?? "DRAFT",
          DNX_PARTNER_PARTICIPATION_STATUSES,
          "DRAFT",
        ) as DnxPartnerParticipationStatus,
        startsAt: parseDateTimeInput(formData.get("startsAt")?.toString() ?? ""),
        endsAt: parseDateTimeInput(formData.get("endsAt")?.toString() ?? ""),
        requiresPayment,
        paymentMode: requiresPayment
          ? (asEnum(
              formData.get("paymentMode")?.toString() ?? "MANUAL",
              DNX_PARTNER_PAYMENT_MODES,
              "MANUAL",
            ) as DnxPartnerPaymentMode)
          : "NONE",
        paymentAmountMinor: requiresPayment
          ? optionalInt(formData.get("paymentAmountMinor")?.toString() ?? "")
          : null,
        paymentNotes: requiresPayment
          ? formData.get("paymentNotes")?.toString()?.trim() || null
          : null,
        estimatedValueMinor: optionalInt(
          formData.get("estimatedValueMinor")?.toString() ?? "",
        ),
        notes: formData.get("notes")?.toString()?.trim() || null,
        allowDuplicateActive: formData.get("allowDuplicateActive") === "true",
        categoryId: formData.get("categoryId")?.toString()?.trim() || null,
        venueId: formData.get("venueId")?.toString()?.trim() || null,
      }),
    );
    if (!result.ok) {
      redirect(
        `${editionSponsorsPath(editionId)}/vincular?error=${encodeURIComponent(result.message)}`,
      );
    }
    revalidateEditionPartners(editionId, result.data.participation.id);
    redirect(`${editionSponsorsPath(editionId, result.data.participation.id)}?ok=linked`);
  } catch (err) {
    const message =
      err instanceof PartnersDomainError
        ? err.message
        : "No se pudo vincular el partner a la edición.";
    redirect(`${editionSponsorsPath(editionId)}/vincular?error=${encodeURIComponent(message)}`);
  }
}

export async function updateEditionParticipationFormAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const editionId = formData.get("editionId")?.toString() ?? "";
  const participationId = formData.get("participationId")?.toString() ?? "";
  const requiresPayment = formData.get("requiresPayment") === "true";

  try {
    const result = await withClickatonDb(async () =>
      updateEditionPartnerParticipation(actor, editionId, participationId, {
        institutionalRole: asEnum(
          formData.get("institutionalRole")?.toString() ?? "SPONSOR",
          DNX_PARTNER_INSTITUTIONAL_ROLES,
          "SPONSOR",
        ) as DnxPartnerInstitutionalRole,
        displayTier: asEnum(
          formData.get("displayTier")?.toString() ?? "STANDARD",
          DNX_PARTNER_DISPLAY_TIERS,
          "STANDARD",
        ) as DnxPartnerDisplayTier,
        displayOrder: optionalInt(formData.get("displayOrder")?.toString() ?? "") ?? 100,
        publicRoleLabel: formData.get("publicRoleLabel")?.toString()?.trim() || null,
        destinationUrl: formData.get("destinationUrl")?.toString()?.trim() || null,
        clickTrackingEnabled: formData.get("clickTrackingEnabled") !== "false",
        title: formData.get("title")?.toString()?.trim() || null,
        description: formData.get("description")?.toString()?.trim() || null,
        status: asEnum(
          formData.get("status")?.toString() ?? "DRAFT",
          DNX_PARTNER_PARTICIPATION_STATUSES,
          "DRAFT",
        ) as DnxPartnerParticipationStatus,
        startsAt: parseDateTimeInput(formData.get("startsAt")?.toString() ?? ""),
        endsAt: parseDateTimeInput(formData.get("endsAt")?.toString() ?? ""),
        requiresPayment,
        paymentMode: requiresPayment
          ? (asEnum(
              formData.get("paymentMode")?.toString() ?? "MANUAL",
              DNX_PARTNER_PAYMENT_MODES,
              "MANUAL",
            ) as DnxPartnerPaymentMode)
          : "NONE",
        paymentAmountMinor: requiresPayment
          ? optionalInt(formData.get("paymentAmountMinor")?.toString() ?? "")
          : null,
        paymentNotes: requiresPayment
          ? formData.get("paymentNotes")?.toString()?.trim() || null
          : null,
        notes: formData.get("notes")?.toString()?.trim() || null,
      }),
    );
    if (!result.ok) {
      redirect(
        `${editionSponsorsPath(editionId, participationId)}?error=${encodeURIComponent(result.message)}`,
      );
    }
  } catch (err) {
    const message =
      err instanceof PartnersDomainError ? err.message : "No se pudo actualizar.";
    redirect(
      `${editionSponsorsPath(editionId, participationId)}?error=${encodeURIComponent(message)}`,
    );
  }
  revalidateEditionPartners(editionId, participationId);
  redirect(`${editionSponsorsPath(editionId, participationId)}?ok=updated`);
}

export async function archiveEditionParticipationFormAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const editionId = formData.get("editionId")?.toString() ?? "";
  const participationId = formData.get("participationId")?.toString() ?? "";
  await withClickatonDb(async () =>
    archiveEditionPartnerParticipation(actor, editionId, participationId),
  );
  revalidateEditionPartners(editionId);
  redirect(`${editionSponsorsPath(editionId)}?ok=archived`);
}

export async function createEditionContributionFormAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const editionId = formData.get("editionId")?.toString() ?? "";
  const participationId = formData.get("participationId")?.toString() ?? "";
  try {
    const result = await withClickatonDb(async () =>
      createEditionPartnerContribution(actor, editionId, {
        participationId,
        type: asEnum(
          formData.get("type")?.toString() ?? "OTHER",
          DNX_PARTNER_CONTRIBUTION_TYPES,
          "OTHER",
        ) as DnxPartnerContributionType,
        title: formData.get("title")?.toString() ?? "",
        description: formData.get("description")?.toString()?.trim() || null,
        quantity: optionalInt(formData.get("quantity")?.toString() ?? ""),
        estimatedUnitValueMinor: optionalInt(
          formData.get("estimatedUnitValueMinor")?.toString() ?? "",
        ),
        estimatedTotalValueMinor: optionalInt(
          formData.get("estimatedTotalValueMinor")?.toString() ?? "",
        ),
        deliveryDate: parseDateTimeInput(formData.get("deliveryDate")?.toString() ?? ""),
        prizeBundleId: formData.get("prizeBundleId")?.toString()?.trim() || null,
        notes: formData.get("notes")?.toString()?.trim() || null,
      }),
    );
    if (!result.ok) {
      redirect(
        `${editionSponsorsPath(editionId, participationId)}?error=${encodeURIComponent(result.message)}`,
      );
    }
  } catch (err) {
    const message =
      err instanceof PartnersDomainError ? err.message : "No se pudo crear el aporte.";
    redirect(
      `${editionSponsorsPath(editionId, participationId)}?error=${encodeURIComponent(message)}`,
    );
  }
  revalidateEditionPartners(editionId, participationId);
  redirect(`${editionSponsorsPath(editionId, participationId)}?ok=contribution`);
}

export async function markEditionContributionDeliveredFormAction(
  formData: FormData,
): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const editionId = formData.get("editionId")?.toString() ?? "";
  const participationId = formData.get("participationId")?.toString() ?? "";
  const contributionId = formData.get("contributionId")?.toString() ?? "";
  await withClickatonDb(async () => {
    const svc = getClickatonPartnersService();
    return svc.markContributionDelivered(actor, contributionId);
  });
  revalidateEditionPartners(editionId, participationId);
  redirect(`${editionSponsorsPath(editionId, participationId)}?ok=delivered`);
}

export async function deleteEditionContributionFormAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const editionId = formData.get("editionId")?.toString() ?? "";
  const participationId = formData.get("participationId")?.toString() ?? "";
  const contributionId = formData.get("contributionId")?.toString() ?? "";
  try {
    const result = await withClickatonDb(async () => {
      const svc = getClickatonPartnersService();
      return svc.deleteContribution(actor, contributionId);
    });
    if (!result.ok) {
      redirect(
        `${editionSponsorsPath(editionId, participationId)}?error=${encodeURIComponent(result.message)}`,
      );
    }
  } catch (err) {
    const message =
      err instanceof PartnersDomainError ? err.message : "No se pudo eliminar el aporte.";
    redirect(
      `${editionSponsorsPath(editionId, participationId)}?error=${encodeURIComponent(message)}`,
    );
  }
  revalidateEditionPartners(editionId, participationId);
  redirect(`${editionSponsorsPath(editionId, participationId)}?ok=contribution-deleted`);
}

export async function linkEditionContributionPrizeFormAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const editionId = formData.get("editionId")?.toString() ?? "";
  const participationId = formData.get("participationId")?.toString() ?? "";
  const contributionId = formData.get("contributionId")?.toString() ?? "";
  const prizeBundleId = formData.get("prizeBundleId")?.toString() ?? "";
  try {
    await withClickatonDb(async () =>
      linkContributionToPrize(actor, editionId, contributionId, prizeBundleId),
    );
  } catch (err) {
    const message =
      err instanceof PartnersDomainError ? err.message : "No se pudo vincular el premio.";
    redirect(
      `${editionSponsorsPath(editionId, participationId)}?error=${encodeURIComponent(message)}`,
    );
  }
  revalidateEditionPartners(editionId, participationId);
  redirect(`${editionSponsorsPath(editionId, participationId)}?ok=prize`);
}

export async function createEditionBenefitFormAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const editionId = formData.get("editionId")?.toString() ?? "";
  const participationId = formData.get("participationId")?.toString() ?? "";
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  const audienceKey = asEnum(
    formData.get("audienceKey")?.toString() ?? "EDITION_PARTICIPANTS",
    CLICKATON_AUDIENCE_OPTIONS.map((o) => o.value),
    "EDITION_PARTICIPANTS",
  );

  try {
    const result = await withClickatonDb(async () =>
      createEditionPartnerBenefit(actor, editionId, {
        partnerId,
        participationId: participationId || null,
        title: formData.get("title")?.toString() ?? "",
        description: formData.get("description")?.toString()?.trim() || null,
        benefitType: asEnum(
          formData.get("benefitType")?.toString() ?? "OTHER",
          DNX_PARTNER_BENEFIT_TYPES,
          "OTHER",
        ) as DnxPartnerBenefitType,
        redemptionMethod: asEnum(
          formData.get("redemptionMethod")?.toString() ?? "CONTACT_PARTNER",
          DNX_PARTNER_REDEMPTION_METHODS,
          "CONTACT_PARTNER",
        ) as DnxPartnerRedemptionMethod,
        promoCode: formData.get("promoCode")?.toString()?.trim() || null,
        discountPercentage: optionalInt(formData.get("discountPercentage")?.toString() ?? ""),
        discountAmountMinor: optionalInt(formData.get("discountAmountMinor")?.toString() ?? ""),
        redemptionInstructions:
          formData.get("redemptionInstructions")?.toString()?.trim() || null,
        terms: formData.get("terms")?.toString()?.trim() || null,
        startsAt: parseDateTimeInput(formData.get("startsAt")?.toString() ?? ""),
        endsAt: parseDateTimeInput(formData.get("endsAt")?.toString() ?? ""),
        totalRedemptionLimit: optionalInt(
          formData.get("totalRedemptionLimit")?.toString() ?? "",
        ),
        perUserRedemptionLimit: optionalInt(
          formData.get("perUserRedemptionLimit")?.toString() ?? "",
        ),
        audienceKey,
        categoryId: formData.get("categoryId")?.toString()?.trim() || null,
        manualUserId: optionalInt(formData.get("manualUserId")?.toString() ?? ""),
      }),
    );
    if (!result.ok) {
      redirect(
        `${editionSponsorsPath(editionId, participationId)}?error=${encodeURIComponent(result.message)}`,
      );
    }
  } catch (err) {
    const message =
      err instanceof PartnersDomainError ? err.message : "No se pudo crear el beneficio.";
    redirect(
      `${editionSponsorsPath(editionId, participationId)}?error=${encodeURIComponent(message)}`,
    );
  }
  revalidateEditionPartners(editionId, participationId);
  redirect(`${editionSponsorsPath(editionId, participationId)}?ok=benefit`);
}

export async function activateEditionBenefitFormAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const editionId = formData.get("editionId")?.toString() ?? "";
  const participationId = formData.get("participationId")?.toString() ?? "";
  const benefitId = formData.get("benefitId")?.toString() ?? "";
  try {
    await withClickatonDb(async () => activateEditionBenefit(actor, editionId, benefitId));
  } catch (err) {
    const message =
      err instanceof PartnersDomainError ? err.message : "No se pudo activar.";
    redirect(
      `${editionSponsorsPath(editionId, participationId)}?error=${encodeURIComponent(message)}`,
    );
  }
  revalidateEditionPartners(editionId, participationId);
  redirect(`${editionSponsorsPath(editionId, participationId)}?ok=activated`);
}

export async function pauseEditionBenefitFormAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const editionId = formData.get("editionId")?.toString() ?? "";
  const participationId = formData.get("participationId")?.toString() ?? "";
  const benefitId = formData.get("benefitId")?.toString() ?? "";
  try {
    await withClickatonDb(async () => pauseEditionBenefit(actor, editionId, benefitId));
  } catch (err) {
    const message =
      err instanceof PartnersDomainError ? err.message : "No se pudo pausar.";
    redirect(
      `${editionSponsorsPath(editionId, participationId)}?error=${encodeURIComponent(message)}`,
    );
  }
  revalidateEditionPartners(editionId, participationId);
  redirect(`${editionSponsorsPath(editionId, participationId)}?ok=paused`);
}

export async function archiveEditionBenefitFormAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const editionId = formData.get("editionId")?.toString() ?? "";
  const participationId = formData.get("participationId")?.toString() ?? "";
  const benefitId = formData.get("benefitId")?.toString() ?? "";
  try {
    await withClickatonDb(async () => archiveEditionBenefit(actor, editionId, benefitId));
  } catch (err) {
    const message =
      err instanceof PartnersDomainError ? err.message : "No se pudo archivar.";
    redirect(
      `${editionSponsorsPath(editionId, participationId)}?error=${encodeURIComponent(message)}`,
    );
  }
  revalidateEditionPartners(editionId, participationId);
  redirect(`${editionSponsorsPath(editionId, participationId)}?ok=benefit_archived`);
}

export async function grantEditionBenefitAccessFormAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const editionId = formData.get("editionId")?.toString() ?? "";
  const participationId = formData.get("participationId")?.toString() ?? "";
  const benefitId = formData.get("benefitId")?.toString() ?? "";
  const userId = optionalInt(formData.get("userId")?.toString() ?? "");
  if (userId == null) {
    redirect(
      `${editionSponsorsPath(editionId, participationId)}?error=${encodeURIComponent("userId inválido")}`,
    );
  }
  try {
    await withClickatonDb(async () =>
      grantEditionBenefitManually(
        actor,
        editionId,
        benefitId,
        userId,
        formData.get("notes")?.toString()?.trim() || null,
      ),
    );
  } catch (err) {
    const message =
      err instanceof PartnersDomainError ? err.message : "No se pudo otorgar el acceso.";
    redirect(
      `${editionSponsorsPath(editionId, participationId)}?error=${encodeURIComponent(message)}`,
    );
  }
  revalidateEditionPartners(editionId, participationId);
  redirect(`${editionSponsorsPath(editionId, participationId)}?ok=grant`);
}

export async function revokeEditionBenefitAccessFormAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const editionId = formData.get("editionId")?.toString() ?? "";
  const participationId = formData.get("participationId")?.toString() ?? "";
  const benefitId = formData.get("benefitId")?.toString() ?? "";
  const userId = optionalInt(formData.get("userId")?.toString() ?? "");
  if (userId == null) {
    redirect(
      `${editionSponsorsPath(editionId, participationId)}?error=${encodeURIComponent("userId inválido")}`,
    );
  }
  try {
    await withClickatonDb(async () =>
      revokeEditionBenefitGrant(actor, editionId, benefitId, userId),
    );
  } catch (err) {
    const message =
      err instanceof PartnersDomainError ? err.message : "No se pudo revocar.";
    redirect(
      `${editionSponsorsPath(editionId, participationId)}?error=${encodeURIComponent(message)}`,
    );
  }
  revalidateEditionPartners(editionId, participationId);
  redirect(`${editionSponsorsPath(editionId, participationId)}?ok=revoked`);
}

/** Crear partner canónico y volver a vincular a la edición. */
export async function createPartnerForEditionFormAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const editionId = formData.get("editionId")?.toString() ?? "";
  const name = formData.get("name")?.toString() ?? "";
  const result = await withClickatonDb(async () => {
    const svc = getClickatonPartnersService();
    return svc.createPartner(actor, {
      name,
      legalName: formData.get("legalName")?.toString()?.trim() || null,
      slug: formData.get("slug")?.toString()?.trim() || null,
      description: formData.get("description")?.toString()?.trim() || null,
      websiteUrl: formData.get("websiteUrl")?.toString()?.trim() || null,
      email: formData.get("email")?.toString()?.trim() || null,
      logoUrl: formData.get("logoUrl")?.toString()?.trim() || null,
    });
  });
  if (!result.ok) {
    redirect(
      `${editionSponsorsPath(editionId)}/vincular?error=${encodeURIComponent(result.message)}`,
    );
  }
  revalidatePath(adminRoutes.sponsors);
  redirect(
    `${editionSponsorsPath(editionId)}/vincular?partnerId=${encodeURIComponent(result.data.id)}&ok=partner_created`,
  );
}
