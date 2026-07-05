"use client";

/**
 * Modal “Encontramos tus fotos” (oferta face-bulk tras búsqueda facial en ClientAlbumView).
 * Ancho: 50vw (máx. viewport menos padding), z por encima de ScreenshotProtection — portar al monorepo si aplica.
 */
import { useEffect } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/Button";

export type FaceBulkOfferModalProps = {
  open: boolean;
  accentColor: string;
  /** Fotos incluidas en el pack (misma base que el checkout). */
  packPhotoCount: number;
  /** Coincidencias devueltas por la búsqueda facial en esta sesión. */
  searchMatchCount: number;
  priceEachLabel: string;
  packPriceLabel: string;
  savingsLabel: string;
  strikethroughTotalLabel: string;
  onBuyAll: () => void;
  onChooseSome: () => void;
  onRemindLater: () => void;
};

export default function FaceBulkOfferModal({
  open,
  accentColor,
  packPhotoCount,
  searchMatchCount,
  priceEachLabel,
  packPriceLabel,
  savingsLabel,
  strikethroughTotalLabel,
  onBuyAll,
  onChooseSome,
  onRemindLater,
}: FaceBulkOfferModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onRemindLater();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onRemindLater]);

  if (!open || typeof document === "undefined") return null;

  const showSearchHint = searchMatchCount > 0 && searchMatchCount !== packPhotoCount;

  return createPortal(
    <div
      className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/55 p-4 sm:p-6 overflow-y-auto overscroll-y-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="face-bulk-offer-title"
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default"
        aria-label="Cerrar"
        onClick={onRemindLater}
      />
      <div
        className="relative z-10 box-border w-[min(50vw,calc(100vw-2rem))] sm:w-[min(50vw,calc(100vw-3rem))] shrink-0 max-h-[min(92vh,900px)] overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-6 pb-5 sm:px-8 sm:pt-8 sm:pb-6">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-2"
            style={{ color: accentColor }}
          >
            Oferta especial
          </p>
          <h2
            id="face-bulk-offer-title"
            className="text-2xl sm:text-[1.65rem] font-bold text-[#111827] leading-tight tracking-tight"
          >
            Encontramos tus fotos
          </h2>

          <p className="mt-4 text-sm leading-relaxed text-[#4b5563] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl px-4 py-3">
            <strong className="text-[#111827]">¿Qué significa comprar todas?</strong> Con{" "}
            <strong>Comprar todas mis fotos</strong> llevás en <strong>un solo paso</strong> el{" "}
            <strong>archivo digital</strong> de cada foto de este grupo (las que coincidieron con tu
            búsqueda). Después pasás al checkout para revisar y pagar. Si preferís llevar solo algunas,
            tocá <strong>Elegir solo algunas</strong> y seleccioná manualmente en la galería.
          </p>

          <div className="mt-6 space-y-4 text-[#374151]">
            <p className="text-base sm:text-[17px] leading-relaxed">
              Se detectaron{" "}
              <span className="font-bold text-[#111827] tabular-nums">{packPhotoCount}</span>{" "}
              {packPhotoCount === 1 ? "fotografía" : "fotografías"} donde aparecés.
              {showSearchHint ? (
                <span className="text-[#6b7280] text-sm block mt-2 font-normal leading-snug">
                  En esta búsqueda te mostramos {searchMatchCount} coincidencia
                  {searchMatchCount === 1 ? "" : "s"} destacada
                  {searchMatchCount === 1 ? "" : "s"}.
                </span>
              ) : null}
            </p>

            <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-4 py-4 space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-[#6b7280]">
                  Precio por foto (digital, final)
                </span>
                <span className="text-lg font-semibold text-[#111827] tabular-nums">
                  {priceEachLabel}
                </span>
              </div>
              <div className="h-px bg-[#e5e7eb]" />
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-[#111827]">Pack: todas juntas</span>
                <div className="text-right">
                  <span className="block text-sm text-[#9ca3af] line-through tabular-nums">
                    {strikethroughTotalLabel}
                  </span>
                  <span
                    className="text-xl font-bold tabular-nums"
                    style={{ color: accentColor }}
                  >
                    {packPriceLabel}
                  </span>
                </div>
              </div>
              <div
                className="rounded-lg px-3 py-2.5 text-center text-sm font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100"
              >
                Si comprás todas juntas, te ahorrás{" "}
                <span className="tabular-nums">{savingsLabel}</span>
              </div>
            </div>

            <p className="text-sm text-[#6b7280] leading-relaxed">
              Podés aprovechar el pack completo ahora o seguir eligiendo manualmente solo las que
              quieras.
            </p>
          </div>
        </div>

        <div className="px-5 pb-5 sm:px-8 sm:pb-8 flex flex-col gap-3">
          <Button
            type="button"
            variant="primary"
            accentColor={accentColor}
            className="w-full justify-center py-3.5 text-base rounded-xl shadow-md"
            onClick={onBuyAll}
          >
            Comprar todas mis fotos
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full justify-center py-3.5 text-base rounded-xl border-[#d1d5db]"
            onClick={onChooseSome}
          >
            Elegir solo algunas
          </Button>
          <button
            type="button"
            className="text-sm text-[#9ca3af] hover:text-[#6b7280] pt-1 transition-colors"
            onClick={onRemindLater}
          >
            Ver después
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
