"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PARTNER_ALLOWED_LOGO_MIMES,
  PARTNER_LOGO_VARIANT_GUIDES,
  partnerLogoResolutionWarning,
  type DnxPartnerBrandAssetType,
} from "@repo/partners/client-safe";
import type { PartnerLogoLibraryAsset } from "@/components/partners/logo/PartnerLogoLibrary";
import { PartnerLogoDualPreview } from "@/components/partners/logo/PartnerLogoDualPreview";
import { PartnerLogoVariantCard } from "@/components/partners/logo/PartnerLogoVariantCard";

type Props = {
  partnerId: string;
  assets?: PartnerLogoLibraryAsset[];
  showLegacyJpegWarning?: boolean;
  approveAction: (formData: FormData) => Promise<void>;
  archiveAction: (formData: FormData) => Promise<void>;
};

const ACCEPT = [...PARTNER_ALLOWED_LOGO_MIMES, ".png", ".webp"].join(",");

/**
 * Biblioteca admin de variantes de logo: upload siempre visible por tipo.
 */
export function AdminPartnerLogoLibrary({
  partnerId,
  assets = [],
  showLegacyJpegWarning = false,
  approveAction,
  archiveAction,
}: Props) {
  const router = useRouter();
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [busyType, setBusyType] = useState<string | null>(null);
  const [errorByType, setErrorByType] = useState<Record<string, string>>({});

  async function handleUpload(type: DnxPartnerBrandAssetType, file: File | null) {
    if (!file) return;
    setErrorByType((prev) => ({ ...prev, [type]: "" }));
    setBusyType(type);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("assetType", type);
      const res = await fetch(`/api/admin/partners/${partnerId}/logo`, {
        method: "POST",
        body,
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.message || json.error || "No se pudo subir el logo.");
      }
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo subir el archivo.";
      setErrorByType((prev) => ({ ...prev, [type]: message }));
    } finally {
      setBusyType(null);
    }
  }

  return (
    <div className="space-y-6">
      {showLegacyJpegWarning ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Hay logos JPG/JPEG históricos. Los nuevos uploads solo admiten PNG o WEBP.
        </p>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        {PARTNER_LOGO_VARIANT_GUIDES.map((guide) => {
          const current = assets.find((a) => a.type === guide.type);
          const resolutionWarn = partnerLogoResolutionWarning(
            current?.width,
            current?.height,
          );
          const isJpeg =
            current?.mimeType === "image/jpeg" || current?.mimeType === "image/jpg";
          const canApprove =
            Boolean(current?.assetId) && current?.approvalStatus !== "APPROVED";
          const canArchive = Boolean(current?.assetId);
          const hasFile = Boolean(current?.fileUrl);

          return (
            <PartnerLogoVariantCard
              key={guide.type}
              title={guide.title}
              description={guide.description}
              recommendation={guide.recommendation}
              previewKind={guide.previewKind}
              required={guide.required}
            >
              <PartnerLogoDualPreview
                src={current?.fileUrl}
                alt={guide.title}
                transparencyHint
              />

              {current?.approvalStatus ? (
                <p className="text-xs text-ck-text-muted">
                  Estado:{" "}
                  {current.approvalStatus === "APPROVED"
                    ? "Aprobado"
                    : current.approvalStatus === "PENDING"
                      ? "Pendiente de aprobación"
                      : current.approvalStatus}
                </p>
              ) : null}

              {resolutionWarn ? (
                <p className="text-xs text-amber-200">{resolutionWarn}</p>
              ) : null}
              {isJpeg && showLegacyJpegWarning ? (
                <p className="text-xs text-amber-200">
                  Este archivo es JPEG legacy. Reemplazalo por PNG o WEBP cuando puedas.
                </p>
              ) : null}
              {errorByType[guide.type] ? (
                <p className="text-sm text-red-300" role="alert">
                  {errorByType[guide.type]}
                </p>
              ) : null}

              <div className="flex flex-col gap-3">
                <input
                  ref={(el) => {
                    inputRefs.current[guide.type] = el;
                  }}
                  id={`admin-logo-upload-${guide.type}`}
                  type="file"
                  accept={ACCEPT}
                  className="sr-only"
                  disabled={busyType != null}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    void handleUpload(guide.type, file);
                  }}
                />
                <button
                  type="button"
                  disabled={busyType != null}
                  onClick={() => inputRefs.current[guide.type]?.click()}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border-2 border-ck-yellow bg-ck-yellow px-5 py-3 text-sm font-semibold text-ck-bg transition hover:bg-ck-yellow-dark disabled:opacity-50 sm:w-auto"
                >
                  {busyType === guide.type
                    ? "Subiendo…"
                    : hasFile
                      ? "Reemplazar archivo"
                      : "Subir PNG o WEBP"}
                </button>
                <p className="text-xs text-ck-text-muted">Solo PNG o WEBP. Sin JPG ni SVG.</p>
              </div>

              {canApprove || canArchive ? (
                <div className="flex flex-wrap gap-3">
                  {canApprove && current?.assetId ? (
                    <form action={approveAction}>
                      <input type="hidden" name="partnerId" value={partnerId} />
                      <input type="hidden" name="assetId" value={current.assetId} />
                      <button
                        type="submit"
                        className="rounded-lg border border-emerald-500/40 px-3 py-2 text-sm text-emerald-200"
                      >
                        Aprobar
                      </button>
                    </form>
                  ) : null}
                  {canArchive && current?.assetId ? (
                    <form action={archiveAction}>
                      <input type="hidden" name="partnerId" value={partnerId} />
                      <input type="hidden" name="assetId" value={current.assetId} />
                      <button
                        type="submit"
                        className="rounded-lg border border-ck-border px-3 py-2 text-sm text-ck-text-muted"
                      >
                        Archivar
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </PartnerLogoVariantCard>
          );
        })}
      </div>
    </div>
  );
}
