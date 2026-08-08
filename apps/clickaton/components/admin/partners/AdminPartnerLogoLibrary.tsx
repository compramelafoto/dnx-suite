"use client";

import { useRouter } from "next/navigation";
import {
  DEFAULT_PARTNER_ASSET_LIMITS,
  type DnxPartnerBrandAssetType,
} from "@repo/partners/client-safe";
import {
  PartnerLogoLibrary,
  type PartnerLogoLibraryAsset,
  type PartnerLogoUploadSlot,
} from "@/components/partners/logo/PartnerLogoLibrary";
import { resolvePartnerBrandAssetSrc } from "@/components/partners/logo/partner-logo-src";
import { parseLogoUploadResponse } from "@/lib/admin/partners/parse-logo-upload-response";
import { refreshPreservingScroll } from "@/lib/admin/preserve-scroll";

type Props = {
  partnerId: string;
  assets?: PartnerLogoLibraryAsset[];
  showLegacyJpegWarning?: boolean;
  approveAction: (formData: FormData) => Promise<void>;
  archiveAction: (formData: FormData) => Promise<void>;
};

/**
 * Biblioteca admin: familias de logo con un archivo por slot (color / claro / oscuro).
 */
export function AdminPartnerLogoLibrary({
  partnerId,
  assets = [],
  showLegacyJpegWarning = false,
  approveAction,
  archiveAction,
}: Props) {
  const router = useRouter();

  async function handleUpload(slot: PartnerLogoUploadSlot, file: File) {
    if (file.size > DEFAULT_PARTNER_ASSET_LIMITS.logoMaxBytes) {
      throw new Error("El archivo supera 4 MB. Comprimí el PNG/WEBP e intentá de nuevo.");
    }
    const body = new FormData();
    body.set("file", file);
    body.set("assetType", slot.type);
    body.set("backgroundType", slot.backgroundType);
    const res = await fetch(`/api/admin/partners/${partnerId}/logo`, {
      method: "POST",
      body,
    });
    const json = await parseLogoUploadResponse<{
      ok?: boolean;
      message?: string;
      error?: string;
      asset?: { fileUrl?: string | null; storageKey?: string | null };
    }>(res);
    if (!res.ok || !json.ok) {
      throw new Error(json.message || json.error || "No se pudo subir el logo.");
    }
    void resolvePartnerBrandAssetSrc({
      fileUrl: json.asset?.fileUrl,
      storageKey: json.asset?.storageKey,
    });
    refreshPreservingScroll(() => router.refresh());
  }

  async function handleReuseGeneral(familyType: DnxPartnerBrandAssetType, enabled: boolean) {
    const res = await fetch(`/api/admin/partners/${partnerId}/logo/reuse-general`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetType: familyType, enabled }),
    });
    const json = await parseLogoUploadResponse<{
      ok?: boolean;
      message?: string;
      error?: string;
    }>(res);
    if (!res.ok || !json.ok) {
      throw new Error(json.message || json.error || "No se pudo reutilizar Logo general.");
    }
    refreshPreservingScroll(() => router.refresh());
  }

  return (
    <PartnerLogoLibrary
      partnerId={partnerId}
      assets={assets}
      showLegacyJpegWarning={showLegacyJpegWarning}
      approveAction={approveAction}
      archiveAction={archiveAction}
      onUpload={handleUpload}
      onReuseGeneral={handleReuseGeneral}
    />
  );
}
