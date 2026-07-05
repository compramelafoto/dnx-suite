"use client";

import CommercialProposal from "@/components/cuantocobro/CommercialProposal";
import { useCuantoCobroBusinessProfile } from "@/components/cuantocobro/BusinessProfileContext";
import { buildCommercialProposalModel } from "@/lib/cuantocobro/commercial-proposal";
import { CC_COMMERCIAL_DISPLAY_MODE_LABELS } from "@/lib/cuantocobro/commercial-presentation";
import type { CuantoCobroBusinessProfile } from "@/lib/cuantocobro/business-profile";
import type { CuantoCobroCalculationComplete, CuantoCobroQuoteInput } from "@/lib/cuantocobro/types";
import type { CuantoCobroPaymentOptionsSnapshot } from "@/lib/cuantocobro/payment/payment-options-types";
import { useMemo } from "react";

type Props = {
  quote: CuantoCobroQuoteInput;
  calculation: CuantoCobroCalculationComplete;
  /** Snapshot congelado de una versión guardada. Si no se pasa, se calcula en vivo desde quote.paymentOptions. */
  paymentOptionsSnapshot?: CuantoCobroPaymentOptionsSnapshot | unknown | null;
  /** Perfil comercial congelado de la versión (evita leer localStorage). */
  businessProfileOverride?: CuantoCobroBusinessProfile | null;
  quoteNumber?: string | null;
  versionNumber?: number | null;
  accentColor?: string | null;
  /** Vista pública: sin hints internos de presentación. */
  variant?: "preview" | "public";
  className?: string;
  showModeHint?: boolean;
};

export default function QuotePreview({
  quote,
  calculation,
  paymentOptionsSnapshot,
  businessProfileOverride,
  quoteNumber,
  versionNumber,
  accentColor,
  variant = "preview",
  className = "",
  showModeHint = true,
}: Props) {
  const { profile: contextBusinessProfile } = useCuantoCobroBusinessProfile();
  const businessProfile = businessProfileOverride ?? contextBusinessProfile;

  const model = useMemo(
    () =>
      buildCommercialProposalModel({
        quote,
        calculation,
        businessProfile,
        paymentOptionsSnapshot,
        quoteNumber,
        versionNumber,
        accentColor,
      }),
    [
      quote,
      calculation,
      businessProfile,
      paymentOptionsSnapshot,
      quoteNumber,
      versionNumber,
      accentColor,
    ],
  );

  return (
    <div className={`cc-quote-preview ${className}`.trim()} aria-label="Vista previa del presupuesto">
      <CommercialProposal model={model} />

      {variant === "preview" && showModeHint ? (
        <p className="cc-quote-preview__mode-hint m-0 mt-3 text-sm text-[var(--cc-color-muted)]">
          Presentación: {CC_COMMERCIAL_DISPLAY_MODE_LABELS[quote.commercialDisplayMode]}.
        </p>
      ) : null}
    </div>
  );
}
