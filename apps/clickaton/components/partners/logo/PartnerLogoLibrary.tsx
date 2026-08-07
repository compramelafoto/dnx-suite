"use client";

import { useRef, useState } from "react";
import {
  PARTNER_ALLOWED_LOGO_MIMES,
  PARTNER_LOGO_FAMILIES,
  partnerLogoResolutionWarning,
  type DnxPartnerBrandAssetType,
  type PartnerLogoSlotBackground,
  type PartnerLogoSlotGuide,
} from "@repo/partners/client-safe";
import { withPreservedScroll } from "@/lib/admin/preserve-scroll";
import { PartnerLogoVariantCard } from "./PartnerLogoVariantCard";
import { findLogoSlotAsset } from "./find-logo-slot-asset";
import { resolvePartnerBrandAssetSrc } from "./partner-logo-src";

export type PartnerLogoLibraryAsset = {
  type: DnxPartnerBrandAssetType;
  backgroundType?: PartnerLogoSlotBackground | string | null;
  assetId?: string;
  fileUrl?: string | null;
  storageKey?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  approvalStatus?: string | null;
};

export type PartnerLogoUploadSlot = {
  type: DnxPartnerBrandAssetType;
  backgroundType: PartnerLogoSlotBackground;
  slotKey: string;
};

type Props = {
  assets?: PartnerLogoLibraryAsset[];
  onUpload?: (slot: PartnerLogoUploadSlot, file: File) => Promise<void> | void;
  readOnly?: boolean;
  showLegacyJpegWarning?: boolean;
  partnerId?: string;
  approveAction?: (formData: FormData) => Promise<void>;
  archiveAction?: (formData: FormData) => Promise<void>;
};

const ACCEPT = PARTNER_ALLOWED_LOGO_MIMES.join(",");

/**
 * Biblioteca de logos por familia: cada slot (Color / claro / oscuro) es un archivo propio.
 */
export function PartnerLogoLibrary({
  assets = [],
  onUpload,
  readOnly = false,
  showLegacyJpegWarning = false,
  partnerId,
  approveAction,
  archiveAction,
}: Props) {
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [errorBySlot, setErrorBySlot] = useState<Record<string, string>>({});
  const [localPreviewBySlot, setLocalPreviewBySlot] = useState<Record<string, string>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const showUploadControls = !readOnly;

  async function handleFile(slot: PartnerLogoSlotGuide, file: File | null) {
    if (!file || readOnly) return;
    if (!onUpload) {
      setErrorBySlot((prev) => ({
        ...prev,
        [slot.slotKey]: "Upload no disponible en esta pantalla.",
      }));
      return;
    }
    setErrorBySlot((prev) => ({ ...prev, [slot.slotKey]: "" }));
    const objectUrl = URL.createObjectURL(file);
    setLocalPreviewBySlot((prev) => {
      const previous = prev[slot.slotKey];
      if (previous) URL.revokeObjectURL(previous);
      return { ...prev, [slot.slotKey]: objectUrl };
    });
    setBusySlot(slot.slotKey);
    try {
      await onUpload(
        {
          type: slot.type,
          backgroundType: slot.backgroundType,
          slotKey: slot.slotKey,
        },
        file,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo subir el archivo.";
      setErrorBySlot((prev) => ({ ...prev, [slot.slotKey]: message }));
      setLocalPreviewBySlot((prev) => {
        const previous = prev[slot.slotKey];
        if (previous) URL.revokeObjectURL(previous);
        const next = { ...prev };
        delete next[slot.slotKey];
        return next;
      });
    } finally {
      setBusySlot(null);
    }
  }

  return (
    <div className="space-y-10">
      {showLegacyJpegWarning ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Hay logos JPG/JPEG históricos. Los nuevos uploads solo admiten PNG o WEBP.
        </p>
      ) : null}

      <p className="text-sm leading-relaxed text-ck-text-secondary">
        Cada casilla es un archivo distinto, con su propia vista previa. Las placas y la landing
        usarán el logo disponible según la familia y el fondo (con fallback al color / general).
      </p>

      {PARTNER_LOGO_FAMILIES.map((family) => (
        <section key={family.id} className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold tracking-tight text-ck-text">{family.title}</h3>
              {family.required ? (
                <span className="rounded-full border border-ck-yellow/40 bg-ck-yellow/10 px-2.5 py-0.5 text-xs font-medium text-ck-yellow">
                  Obligatorio
                </span>
              ) : (
                <span className="rounded-full border border-ck-border px-2.5 py-0.5 text-xs text-ck-text-muted">
                  Opcional
                </span>
              )}
            </div>
            <p className="max-w-3xl text-sm leading-relaxed text-ck-text-secondary">
              {family.description}
            </p>
            <p className="max-w-3xl text-xs leading-relaxed text-ck-text-muted">
              {family.recommendation}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {family.slots.map((slot) => {
              const current = findLogoSlotAsset(assets, slot);
              const resolutionWarn = partnerLogoResolutionWarning(
                current?.width,
                current?.height,
              );
              const isJpeg =
                current?.mimeType === "image/jpeg" || current?.mimeType === "image/jpg";
              const canApprove =
                Boolean(partnerId && approveAction && current?.assetId) &&
                current?.approvalStatus !== "APPROVED";
              const canArchive = Boolean(partnerId && archiveAction && current?.assetId);
              const serverSrc = resolvePartnerBrandAssetSrc({
                fileUrl: current?.fileUrl,
                storageKey: current?.storageKey,
              });
              const previewSrc = localPreviewBySlot[slot.slotKey] || serverSrc;
              const slotLabel = `${family.title} · ${slot.title}`;

              return (
                <PartnerLogoVariantCard
                  key={slot.slotKey}
                  title={slot.title}
                  description={slot.description}
                  recommendation={slot.recommendation}
                  previewKind={slot.previewKind}
                  required={slot.required}
                  previewSrc={previewSrc}
                  previewAlt={slotLabel}
                  className="h-full"
                >
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
                  {errorBySlot[slot.slotKey] ? (
                    <p className="text-sm text-red-300" role="alert">
                      {errorBySlot[slot.slotKey]}
                    </p>
                  ) : null}

                  {showUploadControls ? (
                    <div className="flex flex-col gap-3">
                      <input
                        ref={(el) => {
                          inputRefs.current[slot.slotKey] = el;
                        }}
                        id={`logo-upload-${slot.slotKey}`}
                        type="file"
                        accept={`${ACCEPT},.png,.webp`}
                        className="sr-only"
                        disabled={busySlot != null || !onUpload}
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          e.target.value = "";
                          void handleFile(slot, file);
                        }}
                      />
                      <button
                        type="button"
                        disabled={busySlot != null}
                        onClick={() => inputRefs.current[slot.slotKey]?.click()}
                        className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border-2 border-ck-yellow bg-ck-yellow px-5 py-3 text-sm font-semibold text-ck-bg transition hover:bg-ck-yellow-dark disabled:opacity-50"
                      >
                        {busySlot === slot.slotKey
                          ? "Subiendo…"
                          : previewSrc
                            ? "Reemplazar archivo"
                            : "Subir PNG o WEBP"}
                      </button>
                      <p className="text-xs text-ck-text-muted">Solo PNG o WEBP. Sin JPG ni SVG.</p>
                    </div>
                  ) : null}

                  {canApprove || canArchive ? (
                    <div className="flex flex-wrap gap-3">
                      {canApprove && partnerId && approveAction && current?.assetId ? (
                        <form
                          action={async (formData) => {
                            await withPreservedScroll(() => approveAction(formData));
                          }}
                        >
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
                      {canArchive && partnerId && archiveAction && current?.assetId ? (
                        <form
                          action={async (formData) => {
                            await withPreservedScroll(() => archiveAction(formData));
                          }}
                        >
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
        </section>
      ))}
    </div>
  );
}
