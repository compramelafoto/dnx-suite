"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { ensureAdPlacementCatalog } from "@repo/db/partners-ads-loader";
import {
  DNX_PARTNER_APPLICATIONS,
  DNX_PARTNER_CAMPAIGN_CONTEXT_CATEGORIES,
  DNX_PARTNER_CAMPAIGN_GEO_SCOPES,
  DNX_PARTNER_CAMPAIGN_STATUSES,
  DNX_PARTNER_CREATIVE_DEVICE_TARGETS,
  DNX_PARTNER_CREATIVE_FORMATS,
  DNX_PARTNER_CREATIVE_STATUSES,
  isWelcomeActivationExcludedApplication,
  type DnxPartnerAdPlacementKey,
  type DnxPartnerApplication,
  type DnxPartnerCampaignContextCategory,
  type DnxPartnerCampaignGeoScope,
  type DnxPartnerCampaignStatus,
  type DnxPartnerCreativeDeviceTarget,
  type DnxPartnerCreativeFormat,
  type DnxPartnerCreativeStatus,
} from "@repo/partners";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";
import { parseDateTimeInput } from "@/lib/admin/datetime-input";

function campanasPath(partnerId: string, qs?: string) {
  const base = `${adminRoutes.sponsors}/${partnerId}/campanas`;
  return qs ? `${base}?${qs}` : base;
}

function asEnum<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function revalidateCampaigns(partnerId: string) {
  revalidatePath(`${adminRoutes.sponsors}/${partnerId}`);
  revalidatePath(`${adminRoutes.sponsors}/${partnerId}/campanas`);
}

export async function createCampaignFormAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  const name = formData.get("name")?.toString()?.trim() ?? "";
  if (!partnerId || !name) {
    redirect(campanasPath(partnerId || "x", "error=Nombre+requerido"));
  }

  const result = await withClickatonDb(async () => {
    await ensureAdPlacementCatalog(prisma);
    return prisma.dnxPartnerCampaign.create({
      data: {
        id: randomUUID(),
        partnerId,
        name,
        description: formData.get("description")?.toString()?.trim() || null,
        application: asEnum(
          formData.get("application")?.toString() ?? "CLICKATON",
          DNX_PARTNER_APPLICATIONS,
          "CLICKATON",
        ) as DnxPartnerApplication,
        status: "DRAFT",
        priority: Number.parseInt(formData.get("priority")?.toString() ?? "100", 10) || 100,
        destinationUrl: formData.get("destinationUrl")?.toString()?.trim() || null,
        trackingEnabled: formData.get("trackingEnabled")?.toString() !== "false",
        geoScope: asEnum(
          formData.get("geoScope")?.toString() ?? "GLOBAL",
          DNX_PARTNER_CAMPAIGN_GEO_SCOPES,
          "GLOBAL",
        ) as DnxPartnerCampaignGeoScope,
        startsAt: parseDateTimeInput(formData.get("startsAt")?.toString() ?? "") ?? null,
        endsAt: parseDateTimeInput(formData.get("endsAt")?.toString() ?? "") ?? null,
        updatedAt: new Date(),
      },
    });
  });

  if (!result.ok) {
    redirect(campanasPath(partnerId, `error=${encodeURIComponent(result.message)}`));
  }
  revalidateCampaigns(partnerId);
  redirect(campanasPath(partnerId, "ok=created"));
}

export async function setCampaignStatusFormAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  const campaignId = formData.get("campaignId")?.toString() ?? "";
  const status = asEnum(
    formData.get("status")?.toString() ?? "DRAFT",
    DNX_PARTNER_CAMPAIGN_STATUSES,
    "DRAFT",
  ) as DnxPartnerCampaignStatus;

  const result = await withClickatonDb(async () => {
    return prisma.dnxPartnerCampaign.updateMany({
      where: { id: campaignId, partnerId },
      data: {
        status,
        archivedAt: status === "ARCHIVED" ? new Date() : null,
        updatedAt: new Date(),
      },
    });
  });
  if (!result.ok) {
    redirect(campanasPath(partnerId, `error=${encodeURIComponent(result.message)}`));
  }
  revalidateCampaigns(partnerId);
  redirect(campanasPath(partnerId, `ok=status-${status.toLowerCase()}`));
}

export async function saveCampaignTargetingFormAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  const campaignId = formData.get("campaignId")?.toString() ?? "";
  const geoScope = asEnum(
    formData.get("geoScope")?.toString() ?? "GLOBAL",
    DNX_PARTNER_CAMPAIGN_GEO_SCOPES,
    "GLOBAL",
  ) as DnxPartnerCampaignGeoScope;
  const countryCode = formData.get("countryCode")?.toString()?.trim().toUpperCase() || null;
  const province = formData.get("province")?.toString()?.trim() || null;
  const city = formData.get("city")?.toString()?.trim() || null;
  const contexts = formData
    .getAll("context")
    .map((v) => v.toString())
    .filter((v): v is DnxPartnerCampaignContextCategory =>
      (DNX_PARTNER_CAMPAIGN_CONTEXT_CATEGORIES as readonly string[]).includes(v),
    );

  const result = await withClickatonDb(async () => {
    const campaign = await prisma.dnxPartnerCampaign.findFirst({
      where: { id: campaignId, partnerId },
    });
    if (!campaign) throw new Error("Campaña no encontrada");

    await prisma.dnxPartnerCampaign.update({
      where: { id: campaignId },
      data: { geoScope, updatedAt: new Date() },
    });
    await prisma.dnxPartnerCampaignGeoTarget.deleteMany({ where: { campaignId } });
    if (geoScope !== "GLOBAL") {
      await prisma.dnxPartnerCampaignGeoTarget.create({
        data: {
          id: randomUUID(),
          campaignId,
          countryCode: countryCode || "AR",
          province: geoScope === "COUNTRY" ? null : province,
          city: geoScope === "CITY" || geoScope === "MULTI_CITY" ? city : null,
          include: true,
        },
      });
    }
    await prisma.dnxPartnerCampaignContextTarget.deleteMany({ where: { campaignId } });
    if (contexts.length) {
      await prisma.dnxPartnerCampaignContextTarget.createMany({
        data: contexts.map((category) => ({
          id: randomUUID(),
          campaignId,
          category,
        })),
      });
    }
    return true;
  });

  if (!result.ok) {
    redirect(campanasPath(partnerId, `error=${encodeURIComponent(result.message)}`));
  }
  revalidateCampaigns(partnerId);
  redirect(campanasPath(partnerId, "ok=targeting"));
}

export async function createCreativeFormAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  const campaignId = formData.get("campaignId")?.toString() ?? "";
  const assetId = formData.get("assetId")?.toString() ?? "";
  if (!campaignId || !assetId) {
    redirect(campanasPath(partnerId, "error=Asset+requerido"));
  }

  const result = await withClickatonDb(async () => {
    const asset = await prisma.dnxPartnerAsset.findFirst({
      where: { id: assetId, partnerId, archivedAt: null },
    });
    if (!asset) throw new Error("Asset inválido para este partner");

    return prisma.dnxPartnerCampaignCreative.create({
      data: {
        id: randomUUID(),
        campaignId,
        assetId,
        format: asEnum(
          formData.get("format")?.toString() ?? "BANNER_HORIZONTAL",
          DNX_PARTNER_CREATIVE_FORMATS,
          "BANNER_HORIZONTAL",
        ) as DnxPartnerCreativeFormat,
        deviceTarget: asEnum(
          formData.get("deviceTarget")?.toString() ?? "ALL",
          DNX_PARTNER_CREATIVE_DEVICE_TARGETS,
          "ALL",
        ) as DnxPartnerCreativeDeviceTarget,
        title: formData.get("title")?.toString()?.trim() || null,
        body: formData.get("body")?.toString()?.trim() || null,
        ctaText: formData.get("ctaText")?.toString()?.trim() || null,
        destinationUrl: formData.get("destinationUrl")?.toString()?.trim() || null,
        status: asEnum(
          formData.get("status")?.toString() ?? "DRAFT",
          DNX_PARTNER_CREATIVE_STATUSES,
          "DRAFT",
        ) as DnxPartnerCreativeStatus,
        sortOrder: Number.parseInt(formData.get("sortOrder")?.toString() ?? "100", 10) || 100,
        updatedAt: new Date(),
      },
    });
  });

  if (!result.ok) {
    redirect(campanasPath(partnerId, `error=${encodeURIComponent(result.message)}`));
  }
  revalidateCampaigns(partnerId);
  redirect(campanasPath(partnerId, "ok=creative"));
}

export async function bindCampaignPlacementFormAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  const campaignId = formData.get("campaignId")?.toString() ?? "";
  const placementKey = formData.get("placementKey")?.toString() ?? "";
  const application = asEnum(
    formData.get("application")?.toString() ?? "CLICKATON",
    DNX_PARTNER_APPLICATIONS,
    "CLICKATON",
  ) as DnxPartnerApplication;

  if (isWelcomeActivationExcludedApplication(application)) {
    redirect(
      campanasPath(
        partnerId,
        `error=${encodeURIComponent("FotoOffice está excluido de placements publicitarios.")}`,
      ),
    );
  }

  const result = await withClickatonDb(async () => {
    await ensureAdPlacementCatalog(prisma);
    const placement = await prisma.dnxPartnerAdPlacement.findUnique({
      where: {
        application_placementKey: {
          application,
          placementKey: placementKey as DnxPartnerAdPlacementKey,
        },
      },
    });
    if (!placement) throw new Error("Placement no encontrado");
    return prisma.dnxPartnerCampaignPlacement.upsert({
      where: {
        campaignId_adPlacementId: { campaignId, adPlacementId: placement.id },
      },
      create: {
        id: randomUUID(),
        campaignId,
        adPlacementId: placement.id,
        priority: Number.parseInt(formData.get("priority")?.toString() ?? "100", 10) || 100,
        isActive: true,
        updatedAt: new Date(),
      },
      update: {
        isActive: true,
        priority: Number.parseInt(formData.get("priority")?.toString() ?? "100", 10) || 100,
        updatedAt: new Date(),
      },
    });
  });

  if (!result.ok) {
    redirect(campanasPath(partnerId, `error=${encodeURIComponent(result.message)}`));
  }
  revalidateCampaigns(partnerId);
  redirect(campanasPath(partnerId, "ok=placement"));
}

export async function saveCampaignPublishTargetsFormAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  const campaignId = formData.get("campaignId")?.toString() ?? "";
  const apps = formData
    .getAll("targetApp")
    .map((v) => v.toString())
    .filter((v): v is DnxPartnerApplication =>
      (DNX_PARTNER_APPLICATIONS as readonly string[]).includes(v),
    );

  const { setCampaignPublishTargets } = await import("./campaign-publication");
  const result = await withClickatonDb(async () => {
    await setCampaignPublishTargets({ campaignId, applications: apps });
    return true;
  });
  if (!result.ok) {
    redirect(campanasPath(partnerId, `error=${encodeURIComponent(result.message)}`));
  }
  revalidateCampaigns(partnerId);
  redirect(campanasPath(partnerId, "ok=targets"));
}

export async function publishCampaignFormAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  const campaignId = formData.get("campaignId")?.toString() ?? "";
  const onlyApp = formData.get("application")?.toString() || null;
  const { publishCampaignToApps } = await import("./campaign-publication");
  const result = await withClickatonDb(async () => {
    return publishCampaignToApps({
      campaignId,
      applications: onlyApp
        ? [asEnum(onlyApp, DNX_PARTNER_APPLICATIONS, "INFO_SPOT") as DnxPartnerApplication]
        : undefined,
    });
  });
  if (!result.ok) {
    redirect(campanasPath(partnerId, `error=${encodeURIComponent(result.message)}`));
  }
  const failed = result.data.filter((r) => r.status === "FAILED");
  if (failed.length) {
    redirect(
      campanasPath(
        partnerId,
        `error=${encodeURIComponent(failed.map((f) => `${f.application}:${f.error}`).join("; "))}`,
      ),
    );
  }
  revalidateCampaigns(partnerId);
  redirect(campanasPath(partnerId, "ok=published"));
}

export async function retryCampaignPublishFormAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  const campaignId = formData.get("campaignId")?.toString() ?? "";
  const application = asEnum(
    formData.get("application")?.toString() ?? "INFO_SPOT",
    DNX_PARTNER_APPLICATIONS,
    "INFO_SPOT",
  ) as DnxPartnerApplication;
  const { retryCampaignPublication } = await import("./campaign-publication");
  const result = await withClickatonDb(async () =>
    retryCampaignPublication({ campaignId, application }),
  );
  if (!result.ok) {
    redirect(campanasPath(partnerId, `error=${encodeURIComponent(result.message)}`));
  }
  if (result.data.status === "FAILED") {
    redirect(
      campanasPath(partnerId, `error=${encodeURIComponent(result.data.error ?? "retry_failed")}`),
    );
  }
  revalidateCampaigns(partnerId);
  redirect(campanasPath(partnerId, "ok=retry"));
}

export async function pauseResumeCampaignTargetFormAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  const campaignId = formData.get("campaignId")?.toString() ?? "";
  const application = asEnum(
    formData.get("application")?.toString() ?? "INFO_SPOT",
    DNX_PARTNER_APPLICATIONS,
    "INFO_SPOT",
  ) as DnxPartnerApplication;
  const status = formData.get("status")?.toString() === "PAUSED" ? "PAUSED" : "ACTIVE";
  const { setCampaignTargetPublicationStatus } = await import("./campaign-publication");
  const result = await withClickatonDb(async () =>
    setCampaignTargetPublicationStatus({ campaignId, application, status }),
  );
  if (!result.ok) {
    redirect(campanasPath(partnerId, `error=${encodeURIComponent(result.message)}`));
  }
  revalidateCampaigns(partnerId);
  redirect(campanasPath(partnerId, `ok=${status.toLowerCase()}`));
}
