"use client";

import CommercialProposal from "@/components/cuantocobro/CommercialProposal";
import { buildCommercialProposalModel } from "@/lib/cuantocobro/commercial-proposal";
import type { QuotePublicViewPayload } from "@/lib/cuantocobro/quote/quote-public-view";
import type { CuantoCobroCalculationComplete } from "@/lib/cuantocobro/types";
import { useMemo } from "react";

type Props = {
  payload: QuotePublicViewPayload;
};

export default function QuotePublicView({ payload }: Props) {
  const calculation = payload.calculation as CuantoCobroCalculationComplete;

  const model = useMemo(
    () =>
      buildCommercialProposalModel({
        quote: payload.quote,
        calculation,
        businessProfile: payload.businessProfile,
        paymentOptionsSnapshot: payload.paymentOptionsSnapshot,
        quoteNumber: payload.quoteNumber,
        versionNumber: payload.versionNumber,
      }),
    [payload, calculation],
  );

  return (
    <div className="cc-quote-public-view">
      <CommercialProposal model={model} />
    </div>
  );
}
