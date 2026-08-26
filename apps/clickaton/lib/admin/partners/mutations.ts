"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DNX_PARTNER_APPLICATIONS,
  DNX_PARTNER_AUDIENCE_TYPES,
  DNX_PARTNER_BENEFIT_TYPES,
  DNX_PARTNER_CONTEXT_TYPES,
  DNX_PARTNER_CONTRIBUTION_TYPES,
  DNX_PARTNER_PARTICIPATION_TYPES,
  DNX_PARTNER_PAYMENT_MODES,
  DNX_PARTNER_REDEMPTION_METHODS,
  DNX_PARTNER_STATUSES,
  DNX_PARTNER_TYPES,
  PartnersDomainError,
  isWelcomeActivationExcludedApplication,
  type DnxPartnerApplication,
  type DnxPartnerAudienceType,
  type DnxPartnerBenefitType,
  type DnxPartnerContextType,
  type DnxPartnerContributionType,
  type DnxPartnerParticipationType,
  type DnxPartnerPaymentMode,
  type DnxPartnerRedemptionMethod,
  type DnxPartnerStatus,
  type DnxPartnerType,
} from "@repo/partners";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";
import { parseDateTimeInput } from "@/lib/admin/datetime-input";
import { getClickatonPartnersService, toPartnerActor } from "./runtime";

function revalidatePartner(partnerId?: string) {
  revalidatePath(adminRoutes.sponsors);
  if (partnerId) revalidatePath(`${adminRoutes.sponsors}/${partnerId}`);
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

export async function createPartnerFormAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const name = formData.get("name")?.toString() ?? "";
  const result = await withClickatonDb(async () => {
    const svc = getClickatonPartnersService();
    return svc.createPartner(actor, {
      name,
      legalName: formData.get("legalName")?.toString()?.trim() || null,
      slug: formData.get("slug")?.toString()?.trim() || null,
      description: formData.get("description")?.toString()?.trim() || null,
      type: asEnum(formData.get("type")?.toString() ?? "COMPANY", DNX_PARTNER_TYPES, "COMPANY"),
      status: asEnum(
        formData.get("status")?.toString() ?? "PROSPECT",
        DNX_PARTNER_STATUSES,
        "PROSPECT",
      ) as DnxPartnerStatus,
      websiteUrl: formData.get("websiteUrl")?.toString()?.trim() || null,
      instagram: formData.get("instagram")?.toString()?.trim() || null,
      email: formData.get("email")?.toString()?.trim() || null,
      phone: formData.get("phone")?.toString()?.trim() || null,
      taxId: formData.get("taxId")?.toString()?.trim() || null,
      notes: formData.get("notes")?.toString()?.trim() || null,
      logoUrl: formData.get("logoUrl")?.toString()?.trim() || null,
    });
  });
  if (!result.ok) {
    redirect(`${adminRoutes.sponsors}/nuevo?error=${encodeURIComponent(result.message)}`);
  }
  revalidatePartner(result.data.id);
  redirect(`${adminRoutes.sponsors}/${result.data.id}`);
}

export async function updatePartnerFormAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  const result = await withClickatonDb(async () => {
    const svc = getClickatonPartnersService();
    return svc.updatePartner(actor, partnerId, {
      name: formData.get("name")?.toString() ?? undefined,
      legalName: formData.get("legalName")?.toString()?.trim() || null,
      slug: formData.get("slug")?.toString()?.trim() || null,
      description: formData.get("description")?.toString()?.trim() || null,
      type: asEnum(
        formData.get("type")?.toString() ?? "COMPANY",
        DNX_PARTNER_TYPES,
        "COMPANY",
      ) as DnxPartnerType,
      status: asEnum(
        formData.get("status")?.toString() ?? "ACTIVE",
        DNX_PARTNER_STATUSES,
        "ACTIVE",
      ) as DnxPartnerStatus,
      websiteUrl: formData.get("websiteUrl")?.toString()?.trim() || null,
      instagram: formData.get("instagram")?.toString()?.trim() || null,
      email: formData.get("email")?.toString()?.trim() || null,
      phone: formData.get("phone")?.toString()?.trim() || null,
      taxId: formData.get("taxId")?.toString()?.trim() || null,
      notes: formData.get("notes")?.toString()?.trim() || null,
      logoUrl: formData.get("logoUrl")?.toString()?.trim() || null,
    });
  });
  if (!result.ok) {
    redirect(`${adminRoutes.sponsors}/${partnerId}?error=${encodeURIComponent(result.message)}`);
  }
  revalidatePartner(partnerId);
  redirect(`${adminRoutes.sponsors}/${partnerId}?ok=1`);
}

export async function archivePartnerFormAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  await withClickatonDb(async () => {
    const svc = getClickatonPartnersService();
    return svc.archivePartner(actor, partnerId);
  });
  revalidatePartner(partnerId);
  redirect(adminRoutes.sponsors);
}

export async function createParticipationFormAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  const requiresPayment = formData.get("requiresPayment") === "true";
  const application = asEnum(
    formData.get("application")?.toString() ?? "CLICKATON",
    DNX_PARTNER_APPLICATIONS,
    "CLICKATON",
  ) as DnxPartnerApplication;
  if (isWelcomeActivationExcludedApplication(application)) {
    redirect(
      `${adminRoutes.sponsors}/${partnerId}?error=${encodeURIComponent("FotoOffice está excluido de DNX Partners welcome / ads.")}`,
    );
  }
  try {
    const result = await withClickatonDb(async () => {
      const svc = getClickatonPartnersService();
      return svc.createParticipation(actor, {
        partnerId,
        application,
        organizationId: formData.get("organizationId")?.toString()?.trim() || null,
        contextType: asEnum(
          formData.get("contextType")?.toString() ?? "GLOBAL",
          DNX_PARTNER_CONTEXT_TYPES,
          "GLOBAL",
        ) as DnxPartnerContextType,
        contextId: formData.get("contextId")?.toString()?.trim() || null,
        participationType: asEnum(
          formData.get("participationType")?.toString() ?? "SPONSOR",
          DNX_PARTNER_PARTICIPATION_TYPES,
          "SPONSOR",
        ) as DnxPartnerParticipationType,
        title: formData.get("title")?.toString()?.trim() || null,
        description: formData.get("description")?.toString()?.trim() || null,
        status: "DRAFT",
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
      });
    });
    if (!result.ok) {
      redirect(`${adminRoutes.sponsors}/${partnerId}?error=${encodeURIComponent(result.message)}`);
    }
  } catch (err) {
    const message =
      err instanceof PartnersDomainError ? err.message : "No se pudo crear la participación.";
    redirect(`${adminRoutes.sponsors}/${partnerId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePartner(partnerId);
  redirect(`${adminRoutes.sponsors}/${partnerId}?ok=participation`);
}

export async function createContributionFormAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  const participationId = formData.get("participationId")?.toString() ?? "";
  try {
    const result = await withClickatonDb(async () => {
      const svc = getClickatonPartnersService();
      return svc.createContribution(actor, {
        participationId,
        type: asEnum(
          formData.get("type")?.toString() ?? "OTHER",
          DNX_PARTNER_CONTRIBUTION_TYPES,
          "OTHER",
        ) as DnxPartnerContributionType,
        title: formData.get("title")?.toString() ?? "",
        description: formData.get("description")?.toString()?.trim() || null,
        quantity: optionalInt(formData.get("quantity")?.toString() ?? ""),
        estimatedTotalValueMinor: optionalInt(
          formData.get("estimatedTotalValueMinor")?.toString() ?? "",
        ),
        notes: formData.get("notes")?.toString()?.trim() || null,
      });
    });
    if (!result.ok) {
      redirect(`${adminRoutes.sponsors}/${partnerId}?error=${encodeURIComponent(result.message)}`);
    }
  } catch (err) {
    const message =
      err instanceof PartnersDomainError ? err.message : "No se pudo crear el aporte.";
    redirect(`${adminRoutes.sponsors}/${partnerId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePartner(partnerId);
  redirect(`${adminRoutes.sponsors}/${partnerId}?ok=contribution`);
}

export async function createBenefitFormAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  try {
    const result = await withClickatonDb(async () => {
      const svc = getClickatonPartnersService();
      const benefit = await svc.createBenefit(actor, {
        partnerId,
        participationId: formData.get("participationId")?.toString()?.trim() || null,
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
      });
      const audienceType = asEnum(
        formData.get("audienceType")?.toString() ?? "ALL_USERS",
        DNX_PARTNER_AUDIENCE_TYPES,
        "ALL_USERS",
      ) as DnxPartnerAudienceType;
      await svc.assignAudience(actor, {
        benefitId: benefit.id,
        audienceType,
        organizationId: formData.get("audienceOrganizationId")?.toString()?.trim() || null,
        contextType: formData.get("audienceContextType")?.toString()?.trim()
          ? (asEnum(
              formData.get("audienceContextType")!.toString(),
              DNX_PARTNER_CONTEXT_TYPES,
              "OTHER",
            ) as DnxPartnerContextType)
          : null,
        contextId: formData.get("audienceContextId")?.toString()?.trim() || null,
      });
      return benefit;
    });
    if (!result.ok) {
      redirect(`${adminRoutes.sponsors}/${partnerId}?error=${encodeURIComponent(result.message)}`);
    }
  } catch (err) {
    const message =
      err instanceof PartnersDomainError ? err.message : "No se pudo crear el beneficio.";
    redirect(`${adminRoutes.sponsors}/${partnerId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePartner(partnerId);
  redirect(`${adminRoutes.sponsors}/${partnerId}?ok=benefit`);
}

export async function createContactFormAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  await withClickatonDb(async () => {
    const svc = getClickatonPartnersService();
    return svc.createContact(actor, {
      partnerId,
      firstName: formData.get("firstName")?.toString() ?? "",
      lastName: formData.get("lastName")?.toString()?.trim() || null,
      roleTitle: formData.get("roleTitle")?.toString()?.trim() || null,
      email: formData.get("email")?.toString()?.trim() || null,
      phone: formData.get("phone")?.toString()?.trim() || null,
      whatsapp: formData.get("whatsapp")?.toString()?.trim() || null,
      isPrimary: formData.get("isPrimary") === "on",
      notes: formData.get("notes")?.toString()?.trim() || null,
    });
  });
  revalidatePartner(partnerId);
  redirect(`${adminRoutes.sponsors}/${partnerId}?ok=contact`);
}
