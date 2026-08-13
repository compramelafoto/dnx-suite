"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { ensureAdPlacementCatalog } from "@repo/db/partners-ads-loader";
import {
  assertWelcomeAdminScopeConfig,
  assertWelcomePlacementPublishable,
  buildWelcomeGraphicMetadata,
  contextTypeForWelcomeScope,
  getWelcomeGraphicSlot,
  isAnimatedWelcomeMime,
  isMountedWelcomePlacementKey,
  isWelcomeActivationExcludedApplication,
  validateWelcomeCampaignBeforePublish,
  wrapWelcomeGraphicMetadata,
  type WelcomeAdminScopeKind,
  type DnxPartnerApplication,
  type DnxPartnerAdPlacementKey,
  type WelcomeGraphicSlotKey,
} from "@repo/partners";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";
import {
  resolveWelcomeContextEntity,
  searchWelcomeContextEntities,
  WelcomeContextAdapterError,
} from "./welcome-context-search";

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
      error:
        e instanceof WelcomeContextAdapterError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Error de búsqueda",
    };
  }
}

/**
 * Alta de asset welcome por URL pública como PENDING (solo preview).
 * Publicar exige aprobación formal posterior.
 * Soporta gráfica desktop/mobile (+ fallback estático) vía metadata tipada.
 */
export async function registerPartnerAssetUrlFormAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  const fileUrl = formData.get("fileUrl")?.toString()?.trim() ?? "";
  const altText = formData.get("altText")?.toString()?.trim() ?? "";
  const slotKey = formData.get("welcomeSlot")?.toString()?.trim() ?? "";
  const mimeHint = formData.get("mimeType")?.toString()?.trim().toLowerCase() ?? "";
  if (!partnerId || !fileUrl || !/^https?:\/\//i.test(fileUrl)) {
    redirect(campanasPath(partnerId || "x", "error=URL+de+asset+inv%C3%A1lida"));
  }
  if (!altText) {
    redirect(campanasPath(partnerId, "error=Texto+alternativo+requerido"));
  }
  if (/\.svg(\?|$)/i.test(fileUrl)) {
    redirect(campanasPath(partnerId, "error=SVG+no+admitido"));
  }

  let metadata: Record<string, unknown> | undefined;
  let name = altText.slice(0, 120);
  let mimeType = mimeHint || "image/png";
  if (slotKey) {
    try {
      const slot = getWelcomeGraphicSlot(slotKey as WelcomeGraphicSlotKey);
      const animated =
        isAnimatedWelcomeMime(mimeType) ||
        /\.gif(\?|$)/i.test(fileUrl) ||
        mimeHint === "image/gif";
      if (animated) mimeType = "image/gif";
      metadata = wrapWelcomeGraphicMetadata(
        buildWelcomeGraphicMetadata({
          deviceTarget: slot.deviceTarget,
          motionVariant: slot.motionVariant,
          animated: slot.motionVariant === "STATIC_FALLBACK" ? false : animated,
          isDefault: true,
        }),
      ) as unknown as Record<string, unknown>;
      name = `${slot.title} · ${altText}`.slice(0, 120);
    } catch {
      redirect(campanasPath(partnerId, "error=Slot+welcome+inv%C3%A1lido"));
    }
  }

  const result = await withClickatonDb(async () => {
    return prisma.dnxPartnerAsset.create({
      data: {
        id: randomUUID(),
        partnerId,
        type: "BRAND_PHOTO",
        name,
        fileUrl,
        mimeType,
        altText,
        status: "ACTIVE",
        approvalStatus: "PENDING",
        approvedAt: null,
        metadata: metadata as never,
        updatedAt: new Date(),
      },
    });
  });
  if (!result.ok) {
    redirect(campanasPath(partnerId, `error=${encodeURIComponent(result.message)}`));
  }
  revalidateCampaigns(partnerId);
  redirect(campanasPath(partnerId, "ok=asset-pending"));
}

/** Aprobación formal de asset del sponsor (requisito para publicar welcome). */
export async function approvePartnerAssetFormAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  const assetId = formData.get("assetId")?.toString() ?? "";
  if (!partnerId || !assetId) {
    redirect(campanasPath(partnerId || "x", "error=Asset+inv%C3%A1lido"));
  }

  const result = await withClickatonDb(async () => {
    const asset = await prisma.dnxPartnerAsset.findFirst({
      where: { id: assetId, partnerId, archivedAt: null },
    });
    if (!asset) throw new Error("Asset no encontrado para este sponsor");
    if (!asset.fileUrl?.trim()) throw new Error("Asset sin URL pública");
    if (!asset.altText?.trim()) throw new Error("Asset sin texto alternativo");
    if (/\.svg(\?|$)/i.test(asset.fileUrl) || (asset.mimeType ?? "").includes("svg")) {
      throw new Error("SVG no admitido");
    }
    return prisma.dnxPartnerAsset.update({
      where: { id: assetId },
      data: {
        approvalStatus: "APPROVED",
        approvedAt: new Date(),
        status: "ACTIVE",
        updatedAt: new Date(),
      },
    });
  });
  if (!result.ok) {
    redirect(campanasPath(partnerId, `error=${encodeURIComponent(result.message)}`));
  }
  revalidateCampaigns(partnerId);
  redirect(campanasPath(partnerId, "ok=asset-approved"));
}

/**
 * Vincula participación explícita (GLOBAL/PLATFORM/EDITION/CONTEST/ALBUM) a la campaña.
 */
export async function linkWelcomeParticipationFormAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  const campaignId = formData.get("campaignId")?.toString() ?? "";
  const scopeKind = (formData.get("scopeKind")?.toString() ?? "GLOBAL") as WelcomeAdminScopeKind;
  let contextId = formData.get("contextId")?.toString()?.trim() || null;

  if (!(SCOPE_KINDS as readonly string[]).includes(scopeKind)) {
    redirect(campanasPath(partnerId, "error=Alcance+inv%C3%A1lido"));
  }

  try {
    if (scopeKind === "EDITION" || scopeKind === "CONTEST" || scopeKind === "ALBUM") {
      const resolved = await resolveWelcomeContextEntity({
        scopeKind,
        contextId: contextId ?? "",
      });
      contextId = resolved.id;
    }

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
    const message =
      e instanceof WelcomeContextAdapterError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Alcance inválido";
    redirect(campanasPath(partnerId, `error=${encodeURIComponent(message)}`));
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

  try {
    if (scopeKind === "EDITION" || scopeKind === "CONTEST" || scopeKind === "ALBUM") {
      // Resolver entidad antes de validar publish (fail-closed si DB canónica ausente).
      const loaded = await withClickatonDb(async () => {
        return prisma.dnxPartnerCampaign.findFirst({
          where: { id: campaignId, partnerId },
          select: { participation: { select: { contextId: true } } },
        });
      });
      if (!loaded.ok || !loaded.data?.participation?.contextId) {
        redirect(campanasPath(partnerId, "error=Falta+contexto+can%C3%B3nico"));
      }
      await resolveWelcomeContextEntity({
        scopeKind,
        contextId: loaded.data.participation.contextId,
      });
    }
  } catch (e) {
    redirect(
      campanasPath(
        partnerId,
        `error=${encodeURIComponent(e instanceof Error ? e.message : "Contexto inválido")}`,
      ),
    );
  }

  const result = await withClickatonDb(async () => {
    const campaign = await prisma.dnxPartnerCampaign.findFirst({
      where: { id: campaignId, partnerId },
      include: {
        partner: { select: { status: true, archivedAt: true, id: true } },
        participation: true,
        creatives: { where: { archivedAt: null } },
        placementBindings: {
          include: { adPlacement: true },
        },
      },
    });
    if (!campaign) throw new Error("Campaña no encontrada");

    const welcomeCreative = campaign.creatives.find(
      (c) => c.format === "WELCOME_INTERSTITIAL" && c.status === "APPROVED",
    );
    const asset = welcomeCreative
      ? await prisma.dnxPartnerAsset.findFirst({
          where: { id: welcomeCreative.assetId, archivedAt: null },
          select: {
            partnerId: true,
            approvalStatus: true,
            status: true,
            archivedAt: true,
            fileUrl: true,
            altText: true,
            mimeType: true,
          },
        })
      : null;

    const issues = validateWelcomeCampaignBeforePublish({
      partnerStatus: campaign.partner.status,
      partnerArchivedAt: campaign.partner.archivedAt,
      campaignStatus: campaign.status,
      campaignArchivedAt: campaign.archivedAt,
      application: campaign.application,
      placementKeys: campaign.placementBindings.map((b) => b.adPlacement.placementKey),
      hasApprovedCreative: Boolean(welcomeCreative),
      hasApprovedAssetWithUrl: Boolean(
        asset && asset.approvalStatus === "APPROVED" && asset.fileUrl?.trim(),
      ),
      welcomeAsset: asset
        ? {
            partnerId: campaign.partnerId,
            assetPartnerId: asset.partnerId,
            approvalStatus: asset.approvalStatus,
            status: asset.status,
            archivedAt: asset.archivedAt,
            fileUrl: asset.fileUrl,
            altText: asset.altText,
            mimeType: asset.mimeType,
          }
        : null,
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
