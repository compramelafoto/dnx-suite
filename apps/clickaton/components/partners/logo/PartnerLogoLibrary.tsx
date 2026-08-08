"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  PARTNER_ALLOWED_LOGO_MIMES,
  PARTNER_LOGO_FAMILIES,
  canReusePartnerLogoFamilyFromGeneral,
  partnerLogoFamilyMatchesGeneral,
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
  reusedFromGeneral?: boolean | null;
};

export type PartnerLogoUploadSlot = {
  type: DnxPartnerBrandAssetType;
  backgroundType: PartnerLogoSlotBackground;
  slotKey: string;
};

type Props = {
  assets?: PartnerLogoLibraryAsset[];
  onUpload?: (slot: PartnerLogoUploadSlot, file: File) => Promise<void> | void;
  /** Activa/desactiva “usar los mismos logos que Logo general” por familia. */
  onReuseGeneral?: (
    familyType: DnxPartnerBrandAssetType,
    enabled: boolean,
  ) => Promise<void> | void;
  readOnly?: boolean;
  showLegacyJpegWarning?: boolean;
  partnerId?: string;
  approveAction?: (formData: FormData) => Promise<void>;
  archiveAction?: (formData: FormData) => Promise<void>;
};

const ACCEPT = PARTNER_ALLOWED_LOGO_MIMES.join(",");

function generalSlotFor(slot: PartnerLogoSlotGuide): PartnerLogoSlotGuide {
  return {
    ...slot,
    type: "LOGO_GENERAL",
    slotKey: `LOGO_GENERAL:${slot.backgroundType}`,
  };
}

/**
 * Biblioteca de logos por familia: cada slot (Color / claro / oscuro) es un archivo propio.
 */
export function PartnerLogoLibrary({
  assets = [],
  onUpload,
  onReuseGeneral,
  readOnly = false,
  showLegacyJpegWarning = false,
  partnerId,
  approveAction,
  archiveAction,
}: Props) {
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [busyFamily, setBusyFamily] = useState<string | null>(null);
  const [errorBySlot, setErrorBySlot] = useState<Record<string, string>>({});
  const [familyError, setFamilyError] = useState<Record<string, string>>({});
  const [localPreviewBySlot, setLocalPreviewBySlot] = useState<Record<string, string>>({});
  const [reuseByFamily, setReuseByFamily] = useState<Record<string, boolean>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const showUploadControls = !readOnly;

  const derivedReuse = useMemo(() => {
    const next: Record<string, boolean> = {};
    for (const family of PARTNER_LOGO_FAMILIES) {
      if (!canReusePartnerLogoFamilyFromGeneral(family.type)) continue;
      next[family.id] = partnerLogoFamilyMatchesGeneral({
        familyType: family.type,
        assets,
      });
    }
    return next;
  }, [assets]);

  useEffect(() => {
    if (busyFamily) return;
    setReuseByFamily(derivedReuse);
  }, [derivedReuse, busyFamily]);

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
      setReuseByFamily((prev) => {
        const family = PARTNER_LOGO_FAMILIES.find((f) => f.type === slot.type);
        if (!family) return prev;
        return { ...prev, [family.id]: false };
      });
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

  async function handleReuseToggle(
    familyId: string,
    familyType: DnxPartnerBrandAssetType,
    enabled: boolean,
  ) {
    if (readOnly) return;
    const previous = Boolean(reuseByFamily[familyId] ?? derivedReuse[familyId]);
    setFamilyError((prev) => ({ ...prev, [familyId]: "" }));
    setReuseByFamily((prev) => ({ ...prev, [familyId]: enabled }));
    setBusyFamily(familyId);
    try {
      if (onReuseGeneral) {
        await onReuseGeneral(familyType, enabled);
      } else if (enabled) {
        const hasGeneral = assets.some(
          (a) => a.type === "LOGO_GENERAL" && (a.fileUrl || a.storageKey),
        );
        if (!hasGeneral) {
          throw new Error("Primero subí al menos un archivo en Logo general.");
        }
      }
    } catch (err) {
      setReuseByFamily((prev) => ({ ...prev, [familyId]: previous }));
      const message =
        err instanceof Error ? err.message : "No se pudo aplicar la reutilización.";
      setFamilyError((prev) => ({ ...prev, [familyId]: message }));
    } finally {
      setBusyFamily(null);
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

      {PARTNER_LOGO_FAMILIES.map((family) => {
        const reuseEnabled =
          canReusePartnerLogoFamilyFromGeneral(family.type) &&
          Boolean(reuseByFamily[family.id] ?? derivedReuse[family.id]);

        return (
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

              {canReusePartnerLogoFamilyFromGeneral(family.type) && showUploadControls ? (
                <label className="mt-3 flex max-w-3xl cursor-pointer items-start gap-3 rounded-lg border border-ck-border bg-ck-bg/40 px-4 py-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 rounded border-ck-border accent-ck-yellow"
                    checked={reuseEnabled}
                    disabled={busyFamily === family.id || busySlot != null}
                    onChange={(e) => {
                      void handleReuseToggle(family.id, family.type, e.target.checked);
                    }}
                  />
                  <span className="text-sm leading-relaxed text-ck-text">
                    Usar los mismos logos que se usan en Logo general
                    {busyFamily === family.id ? (
                      <span className="mt-1 block text-xs text-ck-text-muted">Aplicando…</span>
                    ) : (
                      <span className="mt-1 block text-xs text-ck-text-muted">
                        Copia Color / Positivo·Negativo (o Fondo claro·oscuro) desde Logo general a
                        esta sección.
                      </span>
                    )}
                  </span>
                </label>
              ) : null}

              {familyError[family.id] ? (
                <p className="text-sm text-red-300" role="alert">
                  {familyError[family.id]}
                </p>
              ) : null}
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {family.slots.map((slot) => {
                const sourceSlot = reuseEnabled ? generalSlotFor(slot) : slot;
                const current = findLogoSlotAsset(assets, sourceSlot);
                const ownCurrent = findLogoSlotAsset(assets, slot);
                const displayAsset = reuseEnabled ? current : ownCurrent ?? current;
                const resolutionWarn = partnerLogoResolutionWarning(
                  displayAsset?.width,
                  displayAsset?.height,
                );
                const isJpeg =
                  displayAsset?.mimeType === "image/jpeg" ||
                  displayAsset?.mimeType === "image/jpg";
                const canApprove =
                  Boolean(partnerId && approveAction && ownCurrent?.assetId) &&
                  !reuseEnabled &&
                  ownCurrent?.approvalStatus !== "APPROVED";
                const canArchive = Boolean(
                  partnerId && archiveAction && ownCurrent?.assetId && !reuseEnabled,
                );
                const serverSrc = resolvePartnerBrandAssetSrc({
                  fileUrl: displayAsset?.fileUrl,
                  storageKey: displayAsset?.storageKey,
                });
                const previewSrc = reuseEnabled
                  ? serverSrc
                  : localPreviewBySlot[slot.slotKey] || serverSrc;
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
                    {reuseEnabled ? (
                      <p className="text-xs text-ck-text-muted">
                        Vista de Logo general · {slot.title === "Fondo claro" ? "Positivo" : slot.title === "Fondo oscuro" ? "Negativo" : slot.title}
                      </p>
                    ) : null}

                    {displayAsset?.approvalStatus && !reuseEnabled ? (
                      <p className="text-xs text-ck-text-muted">
                        Estado:{" "}
                        {displayAsset.approvalStatus === "APPROVED"
                          ? "Aprobado"
                          : displayAsset.approvalStatus === "PENDING"
                            ? "Pendiente de aprobación"
                            : displayAsset.approvalStatus}
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

                    {showUploadControls && !reuseEnabled ? (
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

                    {reuseEnabled && showUploadControls ? (
                      <p className="text-xs text-ck-text-muted">
                        Desmarcá la casilla para subir archivos propios de esta sección.
                      </p>
                    ) : null}

                    {canApprove || canArchive ? (
                      <div className="flex flex-wrap gap-3">
                        {canApprove && partnerId && approveAction && ownCurrent?.assetId ? (
                          <form
                            action={async (formData) => {
                              await withPreservedScroll(() => approveAction(formData));
                            }}
                          >
                            <input type="hidden" name="partnerId" value={partnerId} />
                            <input type="hidden" name="assetId" value={ownCurrent.assetId} />
                            <button
                              type="submit"
                              className="rounded-lg border border-emerald-500/40 px-3 py-2 text-sm text-emerald-200"
                            >
                              Aprobar
                            </button>
                          </form>
                        ) : null}
                        {canArchive && partnerId && archiveAction && ownCurrent?.assetId ? (
                          <form
                            action={async (formData) => {
                              await withPreservedScroll(() => archiveAction(formData));
                            }}
                          >
                            <input type="hidden" name="partnerId" value={partnerId} />
                            <input type="hidden" name="assetId" value={ownCurrent.assetId} />
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
        );
      })}
    </div>
  );
}
