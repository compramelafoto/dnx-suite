"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DEFAULT_WELCOME_GRAPHIC_LIMITS,
  PartnersDomainError,
  getWelcomeGraphicSlot,
  isAnimatedWelcomeMime,
  maxBytesForWelcomeGraphic,
  type WelcomeGraphicSlotKey,
} from "@repo/partners";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";
import { getWelcomeCardStorage } from "@/lib/welcome-card/storage";
import { getClickatonPartnersService, toPartnerActor } from "@/lib/admin/partners/runtime";

function profilePath(partnerId: string, qs?: string) {
  const base = `${adminRoutes.sponsors}/${partnerId}`;
  return qs ? `${base}?${qs}` : base;
}

function revalidateProfile(partnerId: string) {
  revalidatePath(`${adminRoutes.sponsors}/${partnerId}`);
  revalidatePath(`${adminRoutes.sponsors}/${partnerId}/campanas`);
}

function extensionFor(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

/**
 * Carga gráfica welcome desde archivo (biblioteca del sponsor).
 * No acepta URL externa. No requiere campaña previa.
 */
export async function uploadWelcomeGraphicFromProfileFormAction(
  formData: FormData,
): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  const slotKey = (formData.get("welcomeSlot")?.toString() ?? "") as WelcomeGraphicSlotKey;
  const altText = formData.get("altText")?.toString()?.trim() ?? "";
  const file = formData.get("file");

  if (!partnerId) redirect(profilePath("x", "error=Partner+inv%C3%A1lido"));
  if (!altText) redirect(profilePath(partnerId, "error=Texto+alternativo+requerido"));
  if (!(file instanceof File) || file.size < 1) {
    redirect(profilePath(partnerId, "error=Seleccion%C3%A1+un+archivo"));
  }

  let slot;
  try {
    slot = getWelcomeGraphicSlot(slotKey);
  } catch {
    redirect(profilePath(partnerId, "error=Slot+inv%C3%A1lido"));
  }

  const declaredMime = (file.type || "").toLowerCase().replace("image/jpg", "image/jpeg");
  const animated = isAnimatedWelcomeMime(declaredMime) || /\.gif$/i.test(file.name);
  const maxBytes = maxBytesForWelcomeGraphic({
    deviceTarget: slot.deviceTarget,
    animated: slot.motionVariant === "STATIC_FALLBACK" ? false : animated,
    limits: DEFAULT_WELCOME_GRAPHIC_LIMITS,
  });
  if (file.size > maxBytes) {
    redirect(
      profilePath(
        partnerId,
        `error=${encodeURIComponent(`Archivo demasiado pesado (máx ${Math.round(maxBytes / 1024)} KB).`)}`,
      ),
    );
  }

  const body = Buffer.from(await file.arrayBuffer());
  const mime = declaredMime || (animated ? "image/gif" : "image/png");

  let result;
  try {
    result = await withClickatonDb(async () => {
      const storage = getWelcomeCardStorage();
      const stored = await storage.put({
        namespace: "welcome",
        extension: extensionFor(mime),
        body,
        contentType: mime,
      });
      if (!stored.publicUrl) {
        throw new Error("No se pudo obtener URL pública del storage.");
      }
      const svc = getClickatonPartnersService();
      return svc.replaceWelcomeGraphicAsset(actor, {
        partnerId,
        deviceTarget: slot.deviceTarget,
        motionVariant: slot.motionVariant,
        fileUrl: stored.publicUrl,
        altText,
        mimeType: mime,
        fileExtension: extensionFor(mime),
        fileSize: file.size,
        originalFilename: file.name.slice(0, 180),
        buffer: new Uint8Array(body),
      });
    });
  } catch (err) {
    if (err instanceof PartnersDomainError) {
      redirect(profilePath(partnerId, `error=${encodeURIComponent(err.message)}`));
    }
    throw err;
  }

  if (!result.ok) {
    redirect(profilePath(partnerId, `error=${encodeURIComponent(result.message)}`));
  }
  revalidateProfile(partnerId);
  redirect(profilePath(partnerId, "ok=welcome-graphic-pending"));
}

export async function approveWelcomeGraphicFromProfileFormAction(
  formData: FormData,
): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  const assetId = formData.get("assetId")?.toString() ?? "";
  if (!partnerId || !assetId) {
    redirect(profilePath(partnerId || "x", "error=Asset+inv%C3%A1lido"));
  }
  let result;
  try {
    result = await withClickatonDb(async () => {
      const svc = getClickatonPartnersService();
      const asset = await svc.approvePartnerAsset(actor, assetId);
      if (asset.partnerId !== partnerId) {
        throw new PartnersDomainError("FORBIDDEN", "Asset de otro sponsor.");
      }
      return asset;
    });
  } catch (err) {
    if (err instanceof PartnersDomainError) {
      redirect(profilePath(partnerId, `error=${encodeURIComponent(err.message)}`));
    }
    throw err;
  }
  if (!result.ok) {
    redirect(profilePath(partnerId, `error=${encodeURIComponent(result.message)}`));
  }
  revalidateProfile(partnerId);
  redirect(profilePath(partnerId, "ok=welcome-graphic-approved"));
}

export async function archiveWelcomeGraphicFromProfileFormAction(
  formData: FormData,
): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  const assetId = formData.get("assetId")?.toString() ?? "";
  if (!partnerId || !assetId) {
    redirect(profilePath(partnerId || "x", "error=Asset+inv%C3%A1lido"));
  }
  let result;
  try {
    result = await withClickatonDb(async () => {
      const svc = getClickatonPartnersService();
      const before = await svc.listWelcomeGraphicAssets(actor, partnerId);
      if (!before.some((a) => a.id === assetId)) {
        throw new PartnersDomainError("NOT_FOUND", "Asset no pertenece a este sponsor.");
      }
      return svc.archivePartnerAsset(actor, assetId);
    });
  } catch (err) {
    if (err instanceof PartnersDomainError) {
      redirect(profilePath(partnerId, `error=${encodeURIComponent(err.message)}`));
    }
    throw err;
  }
  if (!result.ok) {
    redirect(profilePath(partnerId, `error=${encodeURIComponent(result.message)}`));
  }
  revalidateProfile(partnerId);
  redirect(profilePath(partnerId, "ok=welcome-graphic-archived"));
}

export async function setWelcomeGraphicDefaultFromProfileFormAction(
  formData: FormData,
): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const partnerId = formData.get("partnerId")?.toString() ?? "";
  const assetId = formData.get("assetId")?.toString() ?? "";
  if (!partnerId || !assetId) {
    redirect(profilePath(partnerId || "x", "error=Asset+inv%C3%A1lido"));
  }
  let result;
  try {
    result = await withClickatonDb(async () => {
      const svc = getClickatonPartnersService();
      return svc.setWelcomeGraphicDefault(actor, { partnerId, assetId });
    });
  } catch (err) {
    if (err instanceof PartnersDomainError) {
      redirect(profilePath(partnerId, `error=${encodeURIComponent(err.message)}`));
    }
    throw err;
  }
  if (!result.ok) {
    redirect(profilePath(partnerId, `error=${encodeURIComponent(result.message)}`));
  }
  revalidateProfile(partnerId);
  redirect(profilePath(partnerId, "ok=welcome-graphic-default"));
}
