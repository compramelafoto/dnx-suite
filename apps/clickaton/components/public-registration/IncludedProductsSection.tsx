"use client";

import { useState } from "react";
import type { PublicTicketProductDto } from "@/lib/public-registration/domain/types";
import {
  ARGENTINA_2026_SHIRT_BENEFIT_COPY,
  ARGENTINA_2026_SHIRT_ENDED_COPY,
  ARGENTINA_2026_SHIRT_INCLUDED_COPY,
  presentShirtBenefitMessage,
} from "@/lib/catalog/domain/first-n-benefit";

type Props = {
  products: PublicTicketProductDto[];
  selected: boolean;
  variantChoices: Record<string, string>;
  onVariantChange: (productId: string, variantId: string) => void;
  /** Mensaje cuando la fase no incluye merch / promoción finalizó. */
  emptyPhaseMessage?: string | null;
  /** Oferta first-N vigente. */
  benefitAvailable?: boolean;
  benefitEnded?: boolean;
};

export function IncludedProductsSection({
  products,
  selected,
  variantChoices,
  onVariantChange,
  emptyPhaseMessage,
  benefitAvailable,
  benefitEnded,
}: Props) {
  const [sizeChartProductId, setSizeChartProductId] = useState<string | null>(null);
  const sizeChartProduct = products.find((p) => p.productId === sizeChartProductId);

  if (products.length === 0) {
    if (benefitEnded) {
      return (
        <div className="mt-4 space-y-2 rounded border border-ck-border bg-ck-surface/40 p-4">
          <p className="text-sm font-semibold text-ck-text" role="status">
            {presentShirtBenefitMessage("ended") ?? ARGENTINA_2026_SHIRT_ENDED_COPY}
          </p>
        </div>
      );
    }
    return emptyPhaseMessage ? (
      <p className="mt-4 text-sm text-ck-text-secondary">{emptyPhaseMessage}</p>
    ) : null;
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-ck-text" role="status">
          {benefitAvailable !== false
            ? (presentShirtBenefitMessage("available") ?? ARGENTINA_2026_SHIRT_INCLUDED_COPY)
            : "Tu inscripción incluye"}
        </p>
        {benefitAvailable === false ? (
          <p className="text-xs text-ck-text-secondary">{ARGENTINA_2026_SHIRT_BENEFIT_COPY}</p>
        ) : null}
      </div>
      <ul className="space-y-4">
        {products.map((p) => {
          const activeVariants = [...p.variants]
            .filter((v) => v.isActive && v.availableStock > 0)
            .sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100));
          const showVariant = selected && p.requiresVariantChoice;
          return (
            <li
              key={`${p.sourceType ?? "TICKET_BASE"}-${p.productId}`}
              className="rounded border border-ck-border bg-ck-surface/60 p-4"
            >
              <div className="flex flex-col gap-4 sm:flex-row">
                {p.primaryImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.primaryImageUrl}
                    alt={p.productName}
                    className="h-40 w-full shrink-0 rounded object-cover sm:h-28 sm:w-28"
                  />
                ) : (
                  <div className="flex h-40 w-full shrink-0 items-center justify-center rounded border border-dashed border-ck-border bg-ck-bg text-xs text-ck-text-muted sm:h-28 sm:w-28">
                    Foto pendiente
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="font-semibold text-ck-text">
                    {p.quantity}× {p.productName}
                  </p>
                  {p.productDescription ? (
                    <p className="text-sm text-ck-text-secondary">{p.productDescription}</p>
                  ) : null}
                  <p className="text-xs font-medium text-ck-yellow">Incluido</p>
                  {p.sizeChartUrl || p.sizeChartDescription ? (
                    <button
                      type="button"
                      className="text-sm underline text-ck-text"
                      onClick={() => setSizeChartProductId(p.productId)}
                    >
                      Ver guía de talles
                    </button>
                  ) : (
                    <p className="text-xs text-ck-text-muted">
                      Guía de talles: pendiente de carga
                    </p>
                  )}
                </div>
              </div>
              {p.requiresVariantChoice && !selected ? (
                <p className="mt-4 rounded border border-ck-border bg-ck-bg/50 px-3 py-2 text-sm text-ck-text-secondary">
                  Seleccioná esta entrada para elegir el <strong className="text-ck-text">talle de la remera</strong>.
                </p>
              ) : null}
              {showVariant ? (
                <label className="mt-4 block space-y-2">
                  <span className="text-sm font-semibold text-ck-text">Talle de la remera *</span>
                  <select
                    className="block min-h-12 w-full rounded border-2 border-ck-yellow/60 bg-ck-surface px-3 py-2 text-base text-ck-text"
                    value={variantChoices[p.productId] ?? ""}
                    onChange={(e) => onVariantChange(p.productId, e.target.value)}
                    required
                    aria-required="true"
                    aria-label={`Talle de ${p.productName}`}
                  >
                    <option value="">Elegí talle</option>
                    {activeVariants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </li>
          );
        })}
      </ul>

      {sizeChartProduct &&
      (sizeChartProduct.sizeChartUrl || sizeChartProduct.sizeChartDescription) ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Guía de talles"
          onClick={() => setSizeChartProductId(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-lg border border-ck-border bg-ck-bg p-6 sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-lg font-semibold">
                Guía de talles — {sizeChartProduct.productName}
              </h3>
              <button
                type="button"
                className="min-h-11 text-sm underline"
                onClick={() => setSizeChartProductId(null)}
              >
                Cerrar
              </button>
            </div>
            {sizeChartProduct.sizeChartDescription ? (
              <p className="mt-4 text-sm text-ck-text-secondary">
                {sizeChartProduct.sizeChartDescription}
              </p>
            ) : null}
            {sizeChartProduct.sizeChartInstructions ? (
              <p className="mt-2 text-sm text-ck-text-muted">
                {sizeChartProduct.sizeChartInstructions}
              </p>
            ) : null}
            {sizeChartProduct.sizeChartUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sizeChartProduct.sizeChartUrl}
                alt={`Guía de talles ${sizeChartProduct.productName}`}
                className="mt-4 w-full rounded border border-ck-border"
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
