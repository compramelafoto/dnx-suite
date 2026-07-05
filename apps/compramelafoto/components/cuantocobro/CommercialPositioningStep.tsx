"use client";

import {
  CC_COMMERCIAL_POSITIONING_INTRO,
  CC_COMMERCIAL_POSITIONING_QUESTION,
  COMMERCIAL_POSITIONING_OPTIONS,
  type CommercialPositioningId,
} from "@/lib/cuantocobro/commercial-positioning";
import type { CuantoCobroProfileInput } from "@/lib/cuantocobro/types";
import { cn } from "@/lib/utils";

type Props = {
  profile: CuantoCobroProfileInput;
  onProfileChange: <K extends keyof CuantoCobroProfileInput>(
    key: K,
    value: CuantoCobroProfileInput[K],
  ) => void;
};

export default function CommercialPositioningStep({ profile, onProfileChange }: Props) {
  const selectedId = profile.commercialPositioningId;

  const handleSelect = (id: CommercialPositioningId) => {
    onProfileChange("commercialPositioningId", id);
  };

  return (
    <div className="cc-commercial-positioning ds-stack-section">
      <div className="ds-info-panel cc-info-panel--accent">
        <p className="ds-info-panel__body m-0 text-sm leading-relaxed">{CC_COMMERCIAL_POSITIONING_INTRO}</p>
      </div>

      <div className="cc-commercial-positioning__question">
        <h4 className="cc-commercial-positioning__question-title m-0">{CC_COMMERCIAL_POSITIONING_QUESTION}</h4>
      </div>

      <div className="cc-commercial-positioning__options" role="radiogroup" aria-label={CC_COMMERCIAL_POSITIONING_QUESTION}>
        {COMMERCIAL_POSITIONING_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selectedId === option.id || (selectedId === "" && option.id === "stable")}
              className={cn(
                "cc-commercial-positioning__option",
                (selectedId === option.id || (selectedId === "" && option.id === "stable")) &&
                  "cc-commercial-positioning__option--selected",
              )}
              onClick={() => handleSelect(option.id)}
            >
              <div className="cc-commercial-positioning__option-head">
                <span className="cc-commercial-positioning__option-title">{option.title}</span>
                {option.isRecommended ? (
                  <span className="cc-commercial-positioning__option-badge">Recomendado</span>
                ) : null}
              </div>
              <p className="cc-commercial-positioning__option-desc m-0">{option.description}</p>
            </button>
        ))}
      </div>
    </div>
  );
}
