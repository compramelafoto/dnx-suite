"use client";

import { useState } from "react";

type SizeOption = {
  value: string;
  label: string;
};

type Props = {
  productName?: string | null;
  options: SizeOption[];
  value: string;
  error?: string | null;
  onChange: (value: string) => void;
  sizeChartUrl?: string | null;
  sizeChartDescription?: string | null;
  sizeChartInstructions?: string | null;
};

export function RegistrationShirtSizeStep({
  productName,
  options,
  value,
  error,
  onChange,
  sizeChartUrl,
  sizeChartDescription,
  sizeChartInstructions,
}: Props) {
  const [guideOpen, setGuideOpen] = useState(false);
  const guideAvailable = Boolean(sizeChartUrl || sizeChartDescription);

  if (options.length === 0) return null;

  return (
    <section
      className="rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface/40 p-6 md:p-8"
      aria-labelledby="registration-shirt-title"
    >
      <h2 id="registration-shirt-title" className="text-xl font-semibold tracking-tight md:text-2xl">
        Remera oficial
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-ck-text-secondary md:text-base">
        Te corresponde remera oficial de regalo
        {productName ? ` (${productName})` : ""}. Elegí tu talle para confirmar el
        beneficio al completar el pago.
      </p>

      <fieldset className="mt-8">
        <legend className="sr-only">Talle de remera</legend>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {options.map((opt) => {
            const selected = value === opt.value;
            return (
              <label
                key={opt.value}
                className={[
                  "flex cursor-pointer items-center justify-center rounded-[var(--ck-radius-button)] border px-3 py-3 text-sm font-semibold transition",
                  selected
                    ? "border-ck-yellow bg-ck-yellow text-black"
                    : "border-ck-border bg-ck-bg text-ck-text hover:border-ck-yellow/50",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="shirt-size"
                  className="sr-only"
                  value={opt.value}
                  checked={selected}
                  onChange={() => onChange(opt.value)}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      {error ? (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {guideAvailable ? (
        <button
          type="button"
          className="mt-6 text-sm font-medium text-ck-yellow underline-offset-4 hover:underline"
          onClick={() => setGuideOpen(true)}
        >
          Ver guía de talles
        </button>
      ) : null}

      {guideOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Guía de talles"
          onClick={() => setGuideOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-lg border border-ck-border bg-ck-bg p-6 sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-lg font-semibold">
                Guía de talles{productName ? ` — ${productName}` : ""}
              </h3>
              <button
                type="button"
                className="min-h-11 text-sm underline"
                onClick={() => setGuideOpen(false)}
              >
                Cerrar
              </button>
            </div>
            {sizeChartDescription ? (
              <p className="mt-4 text-sm text-ck-text-secondary">{sizeChartDescription}</p>
            ) : null}
            {sizeChartInstructions ? (
              <p className="mt-2 text-sm text-ck-text-muted">{sizeChartInstructions}</p>
            ) : null}
            {sizeChartUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sizeChartUrl}
                alt={`Guía de talles${productName ? ` ${productName}` : ""}`}
                className="mt-4 w-full rounded border border-ck-border"
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
