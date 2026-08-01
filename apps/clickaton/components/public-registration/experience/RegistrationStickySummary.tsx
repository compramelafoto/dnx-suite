"use client";

import { RegistrationCtaHint } from "./RegistrationCtaHint";
import { RegistrationPromoPrice } from "./RegistrationPromoPrice";
import { RegistrationTrustStrip } from "./RegistrationTrustStrip";
import { formatExperiencePrice } from "./format-experience-price";

type Props = {
  productLabel: string;
  priceMinor: number | null;
  compareAtMinor?: number | null;
  savingsMinor?: number | null;
  usingCredit?: boolean;
  includes: string[];
  nextStepLabel: string;
  ctaLabel: string;
  ctaBusyLabel?: string;
  ctaDisabled?: boolean;
  ctaBusy?: boolean;
  onCta: () => void;
};

export function RegistrationStickySummary({
  productLabel,
  priceMinor,
  compareAtMinor,
  savingsMinor,
  usingCredit,
  includes,
  nextStepLabel,
  ctaLabel,
  ctaBusyLabel = "Preparando tu lugar…",
  ctaDisabled,
  ctaBusy,
  onCta,
}: Props) {
  return (
    <aside
      className="hidden animate-[ck-fade-up_0.3s_ease-out] lg:block lg:sticky lg:top-28 lg:self-start"
      aria-label="Resumen de inscripción"
    >
      <div className="rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface/90 p-6 shadow-[0_16px_40px_rgb(0_0_0_/_0.35)] backdrop-blur-sm xl:p-8">
        <p className="ck-label text-ck-yellow">Qué estás reservando</p>
        <h2 className="mt-3 text-xl font-semibold tracking-tight transition-colors duration-200">
          {productLabel}
        </h2>

        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-ck-text-muted">
            Cuánto cuesta
          </p>
          {usingCredit ? (
            <p className="mt-2 text-3xl font-semibold text-ck-yellow">Con tu Pack</p>
          ) : priceMinor != null ? (
            <RegistrationPromoPrice
              nowMinor={priceMinor}
              beforeMinor={compareAtMinor}
              savingsMinor={savingsMinor}
              size="compact"
            />
          ) : (
            <p className="mt-2 text-3xl font-semibold text-ck-text-muted">Elegí una opción</p>
          )}
        </div>

        <div className="mt-6 border-t border-ck-border pt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-ck-text-muted">
            Qué incluye
          </p>
          <ul className="mt-3 space-y-2 text-sm text-ck-text">
            {includes.map((item) => (
              <li key={item}>✔ {item}</li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-sm text-ck-text-secondary">
          Siguiente paso: <span className="font-medium text-ck-text">{nextStepLabel}</span>
        </p>

        <RegistrationTrustStrip className="mt-5 border-t border-ck-border pt-5" />

        <button
          type="button"
          className="ck-btn ck-btn-primary mt-6 w-full min-h-12 transition duration-200 hover:brightness-105 disabled:opacity-70"
          disabled={ctaDisabled || ctaBusy}
          aria-busy={ctaBusy || undefined}
          onClick={onCta}
        >
          {ctaBusy ? ctaBusyLabel : ctaLabel}
        </button>
        <RegistrationCtaHint />
        {!usingCredit && priceMinor != null && compareAtMinor == null ? (
          <p className="sr-only">{formatExperiencePrice(priceMinor)}</p>
        ) : null}
      </div>
    </aside>
  );
}
