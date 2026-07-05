"use client";

import { useCameraStore } from "@/lib/simulator/camera-store";

const TICKS = [-3, -2, -1, 0, 1, 2, 3] as const;

/**
 * Fotómetro / exposímetro en escala -3…+3 EV.
 */
export default function ExposureMeter() {
  const { derived } = useCameraStore();
  const { meterNeedleEv } = derived;

  const needlePercent = ((meterNeedleEv + 3) / 6) * 100;

  return (
    <div className="cod-vf-meter" aria-label="Fotómetro de exposición">
      <div className="cod-vf-meter__scale">
        {TICKS.map((tick) => (
          <span
            key={tick}
            className={`cod-vf-meter__tick${
              tick === 0
                ? " cod-vf-meter__tick--zero"
                : tick < 0
                  ? " cod-vf-meter__tick--neg"
                  : " cod-vf-meter__tick--pos"
            }`}
          >
            {tick > 0 ? `+${tick}` : tick}
          </span>
        ))}
      </div>
      <div className="cod-vf-meter__track">
        <span className="cod-vf-meter__pole cod-vf-meter__pole--minus" aria-hidden="true">
          −
        </span>
        <span className="cod-vf-meter__pole cod-vf-meter__pole--plus" aria-hidden="true">
          +
        </span>
        <span className="cod-vf-meter__center-mark" aria-hidden="true" />
        <span
          className="cod-vf-meter__needle"
          style={{ left: `${needlePercent}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
