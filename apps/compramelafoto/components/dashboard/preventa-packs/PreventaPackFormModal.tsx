"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppModal from "@/components/ui/AppModal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { preventaSelectClassName } from "./preventa-form-controls";
import { clientTotalArsFromPhotographerBaseArs } from "@/lib/preventa-canjeable/pack-client-price";
import { PACK_EMPTY_ACTIVATION_MESSAGE } from "@/lib/preventa-canjeable/pack-activation";
import { cn } from "@/lib/utils";
import type { PackRow } from "./types";

function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toISOString().slice(0, 16);
  } catch {
    return "";
  }
}

export type PackFormPayload = {
  name: string;
  description: string | null;
  priceClientArs: number;
  isActive: boolean;
  availabilityPhase: "PRE_UPLOAD" | "POST_UPLOAD";
  validFrom: string | null;
  validUntil: string | null;
  redemptionDeadlineAt: string | null;
  currency: string;
};

/** Imagen opcional del pack: se sube tras guardar; `remove` limpia la URL en servidor. */
export type PackCoverMeta = { file: File | null; remove: boolean };

export default function PreventaPackFormModal({
  pack,
  duplicateSource,
  platformFeePercent = 10,
  saving,
  onClose,
  onSubmit,
}: {
  pack: PackRow | null;
  duplicateSource?: PackRow | null;
  platformFeePercent?: number;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: PackFormPayload, cover: PackCoverMeta) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceClientArs, setPriceClientArs] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [availabilityPhase, setAvailabilityPhase] = useState<
    "PRE_UPLOAD" | "POST_UPLOAD"
  >("PRE_UPLOAD");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [redemptionDeadlineAt, setRedemptionDeadlineAt] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pack) {
      setName(pack.name);
      setDescription(pack.description ?? "");
      setPriceClientArs(String(pack.priceClientArs));
      setIsActive(pack.isActive);
      setAvailabilityPhase(pack.availabilityPhase ?? "PRE_UPLOAD");
      setValidFrom(isoToLocalInput(pack.validFrom));
      setValidUntil(isoToLocalInput(pack.validUntil));
      setRedemptionDeadlineAt(isoToLocalInput(pack.redemptionDeadlineAt));
    } else if (duplicateSource) {
      setName(`${duplicateSource.name} (copia)`);
      setDescription(duplicateSource.description ?? "");
      setPriceClientArs(String(duplicateSource.priceClientArs));
      setIsActive(duplicateSource.isActive);
      setAvailabilityPhase(duplicateSource.availabilityPhase ?? "PRE_UPLOAD");
      setValidFrom("");
      setValidUntil("");
      setRedemptionDeadlineAt("");
    } else {
      setName("");
      setDescription("");
      setPriceClientArs("0");
      setIsActive(false);
      setAvailabilityPhase("PRE_UPLOAD");
      setValidFrom("");
      setValidUntil("");
      setRedemptionDeadlineAt("");
    }
    setPendingCoverFile(null);
    setRemoveCover(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setLocalError(null);
  }, [pack, duplicateSource]);

  const coverPreviewObjectUrl = useMemo(() => {
    if (!pendingCoverFile) return null;
    return URL.createObjectURL(pendingCoverFile);
  }, [pendingCoverFile]);

  useEffect(() => {
    return () => {
      if (coverPreviewObjectUrl) URL.revokeObjectURL(coverPreviewObjectUrl);
    };
  }, [coverPreviewObjectUrl]);

  const coverDisplaySrc =
    pendingCoverFile && coverPreviewObjectUrl
      ? coverPreviewObjectUrl
      : !removeCover && pack?.coverImageUrl
        ? pack.coverImageUrl
        : !removeCover && duplicateSource?.coverImageUrl
          ? duplicateSource.coverImageUrl
          : null;

  const clientPreviewArs = useMemo(() => {
    const base = Number(priceClientArs);
    if (!Number.isFinite(base) || base < 0) return null;
    return clientTotalArsFromPhotographerBaseArs(base, platformFeePercent);
  }, [priceClientArs, platformFeePercent]);

  const benefitCount = pack?.benefits?.length ?? duplicateSource?.benefits?.length ?? 0;
  const cannotPublish = benefitCount === 0;
  const isPublished = isActive;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nameTrim = name.trim();
    if (!nameTrim) {
      setLocalError("El nombre es obligatorio.");
      return;
    }
    const price = Number(priceClientArs);
    if (!Number.isFinite(price) || price < 0) {
      setLocalError("El precio debe ser un número mayor o igual a 0.");
      return;
    }
    if (isActive && cannotPublish) {
      setLocalError(PACK_EMPTY_ACTIVATION_MESSAGE);
      return;
    }

    const payload: PackFormPayload = {
      name: nameTrim,
      description: description.trim() || null,
      priceClientArs: price,
      isActive,
      availabilityPhase,
      currency: "ARS",
      validFrom: validFrom ? new Date(validFrom).toISOString() : null,
      validUntil: validUntil ? new Date(validUntil).toISOString() : null,
      redemptionDeadlineAt: redemptionDeadlineAt
        ? new Date(redemptionDeadlineAt).toISOString()
        : null,
    };

    try {
      await onSubmit(payload, {
        file: pendingCoverFile,
        remove: removeCover && !pendingCoverFile,
      });
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : "Error");
    }
  }

  const modalTitle = pack ? "Editar pack" : duplicateSource ? "Duplicar pack" : "Nuevo pack";

  return (
    <AppModal
      open
      onClose={() => !saving && onClose()}
      size="lg"
      title={modalTitle}
      description={
        <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-sm text-gray-600 m-0">
          Definí qué incluye este pack y el precio base que vos cobrás. En la preventa pública el cliente ve ese monto más
          la comisión de plataforma (mismo criterio que la compra del álbum).
        </p>
      }
      titleId="preventa-pack-form-title"
      closeOnBackdrop={!saving}
      closeOnEscape={!saving}
      panelClassName="max-h-[min(92vh,900px)]"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
        <form onSubmit={handleSubmit} className="ds-form-stack w-full max-w-none">
          {localError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{localError}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Nombre del pack *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1">
              Etapa del pack
            </label>
            <select
              value={availabilityPhase}
              onChange={(e) =>
                setAvailabilityPhase(e.target.value as "PRE_UPLOAD" | "POST_UPLOAD")
              }
              disabled={saving}
              className={preventaSelectClassName}
            >
              <option value="PRE_UPLOAD">Antes de subir fotos</option>
              <option value="POST_UPLOAD">Después de subir fotos</option>
            </select>
            <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-xs text-gray-600 m-0 mt-1">
              Cada pack se vende en una sola etapa. Si querés vender antes y después, creá dos packs distintos.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1">
              Qué incluye este pack (descripción)
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              placeholder="Opcional: resumí en lenguaje simple lo que recibe quien compra."
              className="text-sm disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1">
              Foto del pack (opcional, 1:1)
            </label>
            <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-xs text-gray-600 m-0 mb-2">
              Se muestra en el catálogo público de preventa. La imagen se recorta al centro en formato cuadrado
              (800×800 px). JPG, PNG, WebP o GIF, máx. 5 MB.
            </p>
            <div className="flex flex-wrap items-start gap-4">
              <div
                className="w-32 h-32 shrink-0 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] overflow-hidden flex items-center justify-center"
                style={{ aspectRatio: "1" }}
              >
                {coverDisplaySrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverDisplaySrc}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-[#9ca3af] text-center px-2">Sin imagen</span>
                )}
              </div>
              <div className="flex flex-col gap-2 min-w-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={saving}
                  className="text-sm text-[#374151] file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-[#e5e7eb] file:bg-white file:text-sm"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setRemoveCover(false);
                      setPendingCoverFile(f);
                    }
                  }}
                />
                {(pack?.coverImageUrl || pendingCoverFile) && (
                  <button
                    type="button"
                    disabled={saving}
                    className="text-sm text-red-600 hover:text-red-700 underline text-left"
                    onClick={() => {
                      setPendingCoverFile(null);
                      setRemoveCover(true);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    Quitar imagen
                  </button>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1">
              Tu precio del pack ($) *
            </label>
            <Input
              type="number"
              min={0}
              step={1}
              value={priceClientArs}
              onChange={(e) => setPriceClientArs(e.target.value)}
              disabled={saving}
            />
            <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-xs text-gray-600 m-0 mt-1">
              Monto en pesos (lo que configurás vos). El cliente paga este monto + comisión de plataforma{" "}
              {platformFeePercent}%
              {clientPreviewArs != null && Number.isFinite(platformFeePercent) && platformFeePercent > 0 ? (
                <>
                  :{" "}
                  <span className="font-medium text-[#374151]">
                    ${clientPreviewArs.toLocaleString("es-AR")}
                  </span>{" "}
                  en la página de preventa.
                </>
              ) : clientPreviewArs != null ? (
                <>; en tu cuenta la comisión es 0 %, el cliente paga lo mismo que ingresaste.</>
              ) : null}
            </p>
          </div>
          <div className="rounded-xl border border-[#e5e7eb] bg-[#fafafa] p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-[#1a1a1a]">Estado de publicación</span>
              <span
                className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  isPublished ? "bg-emerald-50 text-emerald-800" : "bg-[#f3f4f6] text-[#6b7280]"
                )}
              >
                {isPublished ? "Publicado" : "Borrador"}
              </span>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={saving || (cannotPublish && !isPublished)}
                className="mt-1"
              />
              <span className="text-sm min-w-0">
                <span className="font-medium text-[#1a1a1a]">Publicado</span>
                <span className="block text-xs text-[#6b7280] mt-1 leading-relaxed">
                  {isPublished
                    ? "Los packs publicados aparecen en la página de preventa si cumplen las condiciones de venta."
                    : "Queda como borrador y no se muestra al público."}
                </span>
                {cannotPublish ? (
                  <span className="block text-xs text-amber-700 mt-1.5 leading-relaxed">
                    {PACK_EMPTY_ACTIVATION_MESSAGE}
                  </span>
                ) : null}
              </span>
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1">
              Válido desde (opcional)
            </label>
            <Input
              type="datetime-local"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1">
              Válido hasta (opcional)
            </label>
            <Input
              type="datetime-local"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1">
              Plazo para usar lo comprado (opcional)
            </label>
            <Input
              type="datetime-local"
              value={redemptionDeadlineAt}
              onChange={(e) => setRedemptionDeadlineAt(e.target.value)}
              disabled={saving}
            />
            <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-xs text-gray-600 m-0 mt-1">
              Si lo definís, puede aplicarse como fecha límite para usar lo incluido en el pack después del pago.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e7eb]">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Guardando…" : pack ? "Guardar" : duplicateSource ? "Crear copia" : "Crear pack"}
            </Button>
          </div>
        </form>
      </div>
    </AppModal>
  );
}
