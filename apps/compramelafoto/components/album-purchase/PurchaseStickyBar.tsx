"use client";

import { createPortal } from "react-dom";

export type PurchaseStickyBarPrimaryAction = {
  label: string;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
};

export type PurchaseStickyBarSecondaryAction = {
  label: string;
  disabled?: boolean;
  onClick: () => void;
};

export type PurchaseStickyBarProps = {
  visible: boolean;
  accentColor: string;
  packName: string | null;
  selectedCount: number;
  requiredCount: number | null;
  /** Resumen de selección individual (ej. "4 fotos seleccionadas"). */
  selectedSummaryLabel?: string | null;
  /** Descuento aplicado (ej. "10% OFF aplicado"). */
  discountAppliedLabel?: string | null;
  totalLabel: string | null;
  savingsLabel: string | null;
  errorMessage: string | null;
  statusLine: string | null;
  primaryAction: PurchaseStickyBarPrimaryAction;
  secondaryAction?: PurchaseStickyBarSecondaryAction;
};

export default function PurchaseStickyBar({
  visible,
  accentColor,
  packName,
  selectedCount,
  requiredCount,
  selectedSummaryLabel,
  discountAppliedLabel,
  totalLabel,
  savingsLabel,
  errorMessage,
  statusLine,
  primaryAction,
  secondaryAction,
}: PurchaseStickyBarProps) {
  if (!visible || typeof document === "undefined") return null;

  const packProgressLabel =
    requiredCount != null
      ? `${selectedCount}/${requiredCount} seleccionadas`
      : null;

  const showSinglesSummary = Boolean(selectedSummaryLabel);

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 z-[45] border-t border-[#e5e7eb] bg-white/95 backdrop-blur-md shadow-[0_-8px_30px_rgba(0,0,0,0.08)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      role="region"
      aria-label="Acciones de compra"
    >
      <div className="mx-auto max-w-4xl px-4 py-3 sm:px-6 sm:py-4">
        <div className="mb-3 space-y-1">
          {packName ? (
            <p className="text-sm font-semibold text-[#1a1a1a] truncate">{packName}</p>
          ) : null}

          {showSinglesSummary ? (
            <>
              <p className="text-sm font-medium text-[#1a1a1a]">{selectedSummaryLabel}</p>
              {discountAppliedLabel ? (
                <p className="text-sm font-medium text-emerald-700">{discountAppliedLabel}</p>
              ) : null}
              {totalLabel ? (
                <p className="text-sm font-semibold text-[#1a1a1a]">{totalLabel}</p>
              ) : null}
            </>
          ) : (
            <>
              {selectedSummaryLabel ? (
                <p className="text-sm font-medium text-[#1a1a1a]">{selectedSummaryLabel}</p>
              ) : null}
              {packProgressLabel ? (
                <p className="text-sm text-[#6b7280]">{packProgressLabel}</p>
              ) : null}
              {statusLine ? (
                <p className="text-sm font-medium text-[#374151]">{statusLine}</p>
              ) : null}
              {totalLabel ? (
                <p className="text-sm font-semibold text-[#1a1a1a]">{totalLabel}</p>
              ) : null}
              {savingsLabel ? (
                <p className="text-sm font-medium text-emerald-700">{savingsLabel}</p>
              ) : null}
            </>
          )}

          {errorMessage ? (
            <p className="text-sm font-medium text-red-600 leading-snug">{errorMessage}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={primaryAction.onClick}
          disabled={primaryAction.disabled || primaryAction.loading}
          className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: accentColor }}
        >
          {primaryAction.loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              {primaryAction.label}
            </>
          ) : (
            primaryAction.label
          )}
        </button>

        {secondaryAction ? (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            disabled={secondaryAction.disabled}
            className="mt-2 w-full text-center text-sm text-[#6b7280] underline hover:text-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {secondaryAction.label}
          </button>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

/** Altura aproximada de la barra para padding del contenido. */
export const PURCHASE_STICKY_BAR_CONTENT_PADDING = "pb-40";
