"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DNX_PARTNER_ASSET_BACKGROUNDS } from "@repo/partners";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma, withClickatonDb } from "@/lib/admin/db";
import {
  deletePartnerLogo,
  isPartnerLogoKey,
  uploadPartnerLogo,
} from "./partner-logo-storage";
import { PARTNER_LOGO_UPLOAD_TYPES } from "./partner-logo-types";

function partnerPath(partnerId: string, query?: string): string {
  const base = `${adminRoutes.sponsors}/${partnerId}`;
  return query ? `${base}?${query}` : base;
}

function revalidatePartner(partnerId: string): void {
  revalidatePath(adminRoutes.sponsors);
  revalidatePath(`${adminRoutes.sponsors}/${partnerId}`);
}

function asEnum<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * Sube un logo del sponsor a R2 y lo registra como asset de marca.
 *
 * Queda `ACTIVE` + `APPROVED` porque quien sube es un admin de Clickatón: la
 * aprobación existe para material que envía el partner, no para el que carga
 * la organización. Sin eso el logo no entraría en las placas, que sólo usan
 * assets aprobados.
 */
export async function uploadPartnerLogoFormAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();

  const partnerId = formData.get("partnerId")?.toString()?.trim() ?? "";
  if (!partnerId) {
    redirect(adminRoutes.sponsors);
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(partnerPath(partnerId, "error=Eleg%C3%AD+un+archivo+de+logo"));
  }

  const type = asEnum(
    formData.get("type")?.toString() ?? "",
    PARTNER_LOGO_UPLOAD_TYPES,
    "LOGO_GENERAL"
  );
  const backgroundType = asEnum(
    formData.get("backgroundType")?.toString() ?? "",
    DNX_PARTNER_ASSET_BACKGROUNDS,
    "TRANSPARENT"
  );
  const altText = formData.get("altText")?.toString()?.trim() || null;
  const makePrimary = formData.get("isPrimary")?.toString() === "on";

  let uploaded: Awaited<ReturnType<typeof uploadPartnerLogo>>;
  try {
    uploaded = await uploadPartnerLogo(file);
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo subir el logo";
    if (message === "PARTNER_LOGO_STORAGE_NOT_CONFIGURED") {
      redirect(
        partnerPath(
          partnerId,
          "error=" +
            encodeURIComponent(
              "Almacenamiento R2 no configurado en este entorno: no se puede subir el logo"
            )
        )
      );
    }
    redirect(partnerPath(partnerId, `error=${encodeURIComponent(message)}`));
  }

  const result = await withClickatonDb(async () => {
    return prisma.$transaction(async (tx) => {
      const partner = await tx.dnxPartner.findUnique({
        where: { id: partnerId },
        select: { id: true, name: true, logoUrl: true },
      });
      if (!partner) {
        throw new Error("Sponsor no encontrado");
      }

      if (makePrimary) {
        await tx.dnxPartnerAsset.updateMany({
          where: { partnerId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const asset = await tx.dnxPartnerAsset.create({
        data: {
          partnerId,
          type,
          name: altText?.slice(0, 120) || `Logo de ${partner.name}`.slice(0, 120),
          storageProvider: uploaded.backend === "r2" ? "R2" : "LOCAL",
          storageKey: uploaded.storageKey,
          // Sólo se guarda `fileUrl` si es absoluta (bucket público). Con bucket
          // privado se deja null y el resolver arma `/api/media/<key>`.
          fileUrl: /^https?:\/\//i.test(uploaded.url) ? uploaded.url : null,
          originalFilename: uploaded.filename,
          mimeType: uploaded.mimeType,
          fileExtension: uploaded.filename.split(".").pop()?.toLowerCase() ?? null,
          fileSize: uploaded.sizeBytes,
          width: uploaded.width,
          height: uploaded.height,
          backgroundType,
          isPrimary: makePrimary,
          status: "ACTIVE",
          approvalStatus: "APPROVED",
          approvedById: user.id,
          approvedAt: new Date(),
          uploadedById: user.id,
          altText: altText ?? `Logo de ${partner.name}`,
        },
        select: { id: true },
      });

      // Si el sponsor no tenía logo, el recién subido pasa a ser el visible.
      if (!partner.logoUrl?.trim()) {
        await tx.dnxPartner.update({
          where: { id: partnerId },
          data: { logoUrl: uploaded.url },
        });
      }

      return asset;
    });
  });

  if (!result.ok) {
    // El objeto ya está en R2 pero no quedó registrado: se borra para no dejar huérfanos.
    await deletePartnerLogo(uploaded.storageKey).catch(() => undefined);
    redirect(partnerPath(partnerId, `error=${encodeURIComponent(result.message)}`));
  }

  revalidatePartner(partnerId);
  redirect(partnerPath(partnerId, "ok=logo-subido"));
}

/** Archiva el asset y borra el objeto si vive en el namespace de logos. */
export async function deletePartnerLogoFormAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();

  const partnerId = formData.get("partnerId")?.toString()?.trim() ?? "";
  const assetId = formData.get("assetId")?.toString()?.trim() ?? "";
  if (!partnerId || !assetId) {
    redirect(adminRoutes.sponsors);
  }

  const result = await withClickatonDb(async () => {
    const asset = await prisma.dnxPartnerAsset.findFirst({
      where: { id: assetId, partnerId },
      select: { id: true, storageKey: true, fileUrl: true },
    });
    if (!asset) {
      throw new Error("Logo no encontrado");
    }

    await prisma.dnxPartnerAsset.update({
      where: { id: assetId },
      data: { status: "ARCHIVED", archivedAt: new Date(), isPrimary: false },
    });

    // Si el partner apuntaba a este archivo, se limpia la referencia suelta.
    const partner = await prisma.dnxPartner.findUnique({
      where: { id: partnerId },
      select: { logoUrl: true },
    });
    const pointsHere =
      partner?.logoUrl &&
      asset.storageKey &&
      partner.logoUrl.includes(asset.storageKey);
    if (pointsHere) {
      await prisma.dnxPartner.update({
        where: { id: partnerId },
        data: { logoUrl: null },
      });
    }

    return asset;
  });

  if (!result.ok) {
    redirect(partnerPath(partnerId, `error=${encodeURIComponent(result.message)}`));
  }

  if (result.data.storageKey && isPartnerLogoKey(result.data.storageKey)) {
    await deletePartnerLogo(result.data.storageKey).catch(() => undefined);
  }

  revalidatePartner(partnerId);
  redirect(partnerPath(partnerId, "ok=logo-archivado"));
}
