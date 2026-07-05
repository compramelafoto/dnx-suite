"use client";

import PaymentOptionsSection from "@/components/cuantocobro/PaymentOptionsSection";
import { useCuantoCobroBusinessProfile } from "@/components/cuantocobro/BusinessProfileContext";
import type { CuantoCobroCalculationResult, CuantoCobroQuoteInput } from "@/lib/cuantocobro/types";

type Props = {
  calculation: CuantoCobroCalculationResult;
  quote: CuantoCobroQuoteInput;
  onQuoteChange: <K extends keyof CuantoCobroQuoteInput>(key: K, value: CuantoCobroQuoteInput[K]) => void;
};

export default function CuantoCobroWizardFinancing({ calculation, quote, onQuoteChange }: Props) {
  const { profile: businessProfile } = useCuantoCobroBusinessProfile();

  if (calculation.status === "incomplete") {
    return (
      <div className="ds-info-panel cc-info-panel--warning" role="status">
        <p className="ds-info-panel__title m-0 font-medium normal-case tracking-normal text-sm">
          Completá los pasos anteriores para configurar la financiación.
        </p>
        <ul className="ds-info-panel__body mt-2 mb-0 pl-5 list-disc space-y-1">
          {calculation.missingFields.map((field) => (
            <li key={field}>{field}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <PaymentOptionsSection
      calculation={calculation}
      paymentOptions={quote.paymentOptions}
      businessCountry={businessProfile?.country}
      showHeading={false}
      onPaymentOptionsChange={(paymentOptions) => onQuoteChange("paymentOptions", paymentOptions)}
    />
  );
}
