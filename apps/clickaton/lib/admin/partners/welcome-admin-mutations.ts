"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { ensureAdPlacementCatalog } from "@repo/db/partners-ads-loader";
import {
  assertWelcomeAdminScopeConfig,
  assertWelcomePlacementPublishable,
  contextTypeForWelcomeScope,
  isMountedWelcomePlacementKey,
  isWelcomeActivationExcludedApplication,
  validateWelcomeCampaignBeforePublish,
  type WelcomeAdminScopeKind,
  type DnxPartnerApplication,
  type DnxPartnerAdPlacementKey,
} from "@repo/partners";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";
import { searchWelcomeContextEntities } from "./welcome-context-search";

function campanasPath(partnerId: string, qs?: string) {
  const base = `${adminRoutes.sponsors}/${partnerId}/campanas`;
  return qs ? `${base}?${qs}` : base;
}

function revalidateCampaigns(partnerId: string) {
  revalidatePath(`${adminRoutes.sponsors}/${partnerId}`);
  revalidatePath(`${adminRoutes.sponsors}/${partnerId}/campanas`);
}

const SCOPE_KINDS = ["GLOBAL", "PLATFORM", "EDITION", "CONTEST", "ALBUM"] as const;

export async function searchWelcomeContextAction(formData: FormData): Promise<{
  ok: boolean;
  hits: Awaited<ReturnType<typeof searchWelcomeContextEntities>>;
  error?: string;
}> {
  try {
    await requireClickatonAdmin();
    const scopeKind = formData.get("scopeKind")?.toString() ?? "";
    const query = formData.get("query")?.toString() ?? "";
    if (scopeKind !== "EDITION" && scopeKind !== "CONTEST" && scopeKind !== "ALBUM") {
      return { ok: false, hits: [], error: "Alcance inválido" };
    }
    const hits = await searchWelcomeContextEntities({ scopeKind, query });
    return { ok: true, hits };
  } catch (e) {
    return {
      ok: false,
      hits: [],
      error: e instanceof Error ? e.message : "Error de búsqueda",
    };
  }
}

/** Alta rápida de asset por URL pública (admin). Queda APPROVED para preview/local. */
export async function registerPartnerAssetUrlFormAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  const fileUrl = formData.get("fileUrl")?.toString()?.trim() ?? "";
  const altText = formData.get("altText")?.toString()?.trim() ?? "";
  if (!partnerId || !fileUrl || !/^https?:\/\//i.test(fileUrl)) {
    redirect(campanasPath(partnerId || "x", "error=URL+de+asset+inv%C3%A1lida"));
  }
  if (!altText) {
    redirect(campanasPath(partnerId, "error=Texto+alternativo+requerido"));
  }

  const result = await withClickatonDb(async () => {
    return prisma.dnxPartnerAsset.create({
      data: {
        id: randomUUID(),
        partnerId,
        type: "BRAND_PHOTO",
        name: altText.slice(0, 120),
        fileUrl,
        mimeType: "image/png",
        altText,
        status: "ACTIVE",
        approvalStatus: "APPROVED",
        approvedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  });
  if (!result.ok) {
    redirect(campanasPath(partnerId, `error=${encodeURIComponent(result.message)}`));
  }
  revalidateCampaigns(partnerId);
  redirect(campanasPath(partnerId, "ok=asset"));
}

/**
 * Vincula participación explícita (GLOBAL/PLATFORM/EDITION/CONTEST/ALBUM) a la campaña.
 */
export async function linkWelcomeParticipationFormAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  const campaignId = formData.get("campaignId")?.toString() ?? "";
  const scopeKind = (formData.get("scopeKind")?.toString() ?? "GLOBAL") as WelcomeAdminScopeKind;
  const contextId = formData.get("contextId")?.toString()?.trim() || null;

  if (!(SCOPE_KINDS as readonly string[]).includes(scopeKind)) {
    redirect(campanasPath(partnerId, "error=Alcance+inv%C3%A1lido"));
  }

  try {
    const result = await withClickatonDb(async () => {
      const campaign = await prisma.dnxPartnerCampaign.findFirst({
        where: { id: campaignId, partnerId },
      });
      if (!campaign) throw new Error("Campaña no encontrada");
      if (isWelcomeActivationExcludedApplication(campaign.application)) {
        throw new Error("FotoOffice excluido");
      }

      assertWelcomeAdminScopeConfig({
        scopeKind,
        application: campaign.application,
        contextId,
      });

      const contextType = contextTypeForWelcomeScope(scopeKind);
      const participation = await prisma.dnxPartnerParticipation.create({
        data: {
          id: randomUUID(),
          partnerId,
          application: campaign.application,
          participationType: "SPONSOR",
          contextType,
          contextId: scopeKind === "GLOBAL" || scopeKind === "PLATFORM" ? null : contextId,
          status: "ACTIVE",
          publicVisibility: "PUBLIC",
          title: `Welcome ${scopeKind}${contextId ? ` · ${contextId.slice(0, 12)}` : ""}`,
          updatedAt: new Date(),
        },
      });

      await prisma.dnxPartnerCampaign.update({
        where: { id: campaignId },
        data: { participationId: participation.id, updatedAt: new Date() },
      });
      return participation.id;
    });

    if (!result.ok) {
      redirect(campanasPath(partnerId, `error=${encodeURIComponent(result.message)}`));
    }
  } catch (e) {
    redirect(
      campanasPath(
        partnerId,
        `error=${encodeURIComponent(e instanceof Error ? e.message : "Alcance inválido")}`,
      ),
    );
  }
  revalidateCampaigns(partnerId);
  redirect(campanasPath(partnerId, "ok=welcome-scope"));
}

export async function bindWelcomePlacementFormAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  const campaignId = formData.get("campaignId")?.toString() ?? "";
  const placementKey = formData.get("placementKey")?.toString() ?? "";
  const application = formData.get("application")?.toString() ?? "";

  try {
    assertWelcomePlacementPublishable(application, placementKey);
  } catch (e) {
    redirect(
      campanasPath(
        partnerId,
        `error=${encodeURIComponent(e instanceof Error ? e.message : "Placement inválido")}`,
      ),
    );
  }

  const result = await withClickatonDb(async () => {
    await ensureAdPlacementCatalog(prisma);
    const placement = await prisma.dnxPartnerAdPlacement.findUnique({
      where: {
        application_placementKey: {
          application: application as DnxPartnerApplication,
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
        priority: 100,
        isActive: true,
        updatedAt: new Date(),
      },
      update: { isActive: true, updatedAt: new Date() },
    });
  });

  if (!result.ok) {
    redirect(campanasPath(partnerId, `error=${encodeURIComponent(result.message)}`));
  }
  revalidateCampaigns(partnerId);
  redirect(campanasPath(partnerId, "ok=welcome-placement"));
}

export async function validateWelcomeCampaignFormAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  const campaignId = formData.get("campaignId")?.toString() ?? "";
  const scopeKind = (formData.get("scopeKind")?.toString() ?? "GLOBAL") as WelcomeAdminScopeKind;

  const result = await withClickatonDb(async () => {
    const campaign = await prisma.dnxPartnerCampaign.findFirst({
      where: { id: campaignId, partnerId },
      include: {
        partner: { select: { status: true, archivedAt: true } },
        participation: true,
        creatives: { where: { archivedAt: null } },
        placementBindings: {
          include: { adPlacement: true },
        },
      },
    });
    if (!campaign) throw new Error("Campaña no encontrada");

    const assetIds = campaign.creatives.map((c) => c.assetId);
    const assets = assetIds.length
      ? await prisma.dnxPartnerAsset.findMany({
          where: { id: { in: assetIds }, archivedAt: null },
          select: { approvalStatus: true, fileUrl: true },
        })
      : [];

    const issues = validateWelcomeCampaignBeforePublish({
      partnerStatus: campaign.partner.status,
      partnerArchivedAt: campaign.partner.archivedAt,
      campaignStatus: campaign.status,
      campaignArchivedAt: campaign.archivedAt,
      application: campaign.application,
      placementKeys: campaign.placementBindings.map((b) => b.adPlacement.placementKey),
      hasApprovedCreative: campaign.creatives.some(
        (c) => c.status === "APPROVED" && c.format === "WELCOME_INTERSTITIAL",
      ),
      hasApprovedAssetWithUrl: assets.some(
        (a) => a.approvalStatus === "APPROVED" && Boolean(a.fileUrl?.trim()),
      ),
      destinationUrl:
        campaign.destinationUrl ||
        campaign.creatives.find((c) => c.destinationUrl)?.destinationUrl ||
        null,
      scopeKind,
      contextId: campaign.participation?.contextId ?? null,
      participation: campaign.participation
        ? {
            application: campaign.participation.application,
            contextType: campaign.participation.contextType,
            contextId: campaign.participation.contextId,
            status: campaign.participation.status,
            archivedAt: campaign.participation.archivedAt,
            publicVisibility: campaign.participation.publicVisibility,
            startsAt: campaign.participation.startsAt,
            endsAt: campaign.participation.endsAt,
          }
        : null,
    });

    const errors = issues.filter((i) => i.severity === "error");
    const warnings = issues.filter((i) => i.severity === "warning");
    if (errors.length) {
      throw new Error(errors.map((e) => e.message).join(" · "));
    }
    if (warnings.length) {
      return `warn:${warnings.map((w) => w.message).join(" · ")}`;
    }
    return "ok";
  });

  if (!result.ok) {
    redirect(campanasPath(partnerId, `error=${encodeURIComponent(result.message)}`));
  }
  const payload = result.data ?? "ok";
  if (payload.startsWith("warn:")) {
    redirect(
      campanasPath(
        partnerId,
        `ok=validated-with-warnings&error=${encodeURIComponent(payload.slice(5))}`,
      ),
    );
  }
  revalidateCampaigns(partnerId);
  redirect(campanasPath(partnerId, "ok=validated"));
}

export { isMountedWelcomePlacementKey };
