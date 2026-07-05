"use client";

import {
  formatApertureForViewfinder,
  formatShutterForViewfinder,
  formatWhiteBalance,
  MODE_UI_TITLES,
} from "@/lib/simulator/camera-settings";
import { useCameraStore } from "@/lib/simulator/camera-store";
import { formatHudFocal } from "@/lib/simulator/lenses";

/** Escala visible del fotómetro en el visor DSLR (−2 … +2 EV). */
const METER_SCALE_MIN_EV = -2;
const METER_SCALE_MAX_EV = 2;
/** Recorte con flecha al superar ±1 EV (límites marcados en el visor). */
const METER_CLIP_EV = 1;

function meterEvToTrackPercent(ev: number): number {
  const span = METER_SCALE_MAX_EV - METER_SCALE_MIN_EV;
  return ((ev - METER_SCALE_MIN_EV) / span) * 100;
}

function meterBarPercent(meterNeedleEv: number): number {
  const clamped = Math.max(-METER_CLIP_EV, Math.min(METER_CLIP_EV, meterNeedleEv));
  return meterEvToTrackPercent(clamped);
}

/**
 * Barra inferior del visor óptico DSLR — LCD verde sobre fondo negro.
 * Modo · distancia focal · tiempo de exposición · diafragma · fotómetro · ISO · WB.
 */
export default function DslrViewfinderBar() {
  const { settings, lens, derived } = useCameraStore();
  const { effectiveSettings, meterNeedleEv } = derived;
  const barPercent = meterBarPercent(meterNeedleEv);
  const meterClippedUnder = meterNeedleEv < -METER_CLIP_EV;
  const meterClippedOver = meterNeedleEv > METER_CLIP_EV;

  const modeLabel = settings.mode;
  const focalLabel = formatHudFocal(lens);
  const shutterLabel = formatShutterForViewfinder(effectiveSettings.shutterSpeed);
  const apertureLabel = formatApertureForViewfinder(effectiveSettings.aperture);
  const isoLabel = String(effectiveSettings.iso);
  const wbLabel = formatWhiteBalance(settings.whiteBalance).replace(" K", "K");
  const meterEvRounded = Math.round(meterNeedleEv * 10) / 10;

  return (
    <div
      className="cod-vf-dslr"
      role="group"
      aria-label={`Visor DSLR. Modo ${MODE_UI_TITLES[settings.mode]}. Distancia focal ${focalLabel}. Tiempo de exposición ${shutterLabel}. Diafragma ${apertureLabel}. ISO ${isoLabel}. Balance de blancos ${wbLabel}. Fotómetro ${meterEvRounded >= 0 ? "+" : ""}${meterEvRounded} EV.${meterClippedUnder ? " Por debajo de la escala." : ""}${meterClippedOver ? " Por encima de la escala." : ""}`}
    >
      <div className="cod-vf-dslr__bar">
        <span
          className="cod-vf-dslr__lcd cod-vf-dslr__lcd--mode"
          aria-label={MODE_UI_TITLES[settings.mode]}
          title={MODE_UI_TITLES[settings.mode]}
        >
          {modeLabel}
        </span>

        <span className="cod-vf-dslr__lcd cod-vf-dslr__lcd--iso">
          <span className="cod-vf-dslr__iso-tag">ISO</span> {isoLabel}
        </span>

        <span
          className="cod-vf-dslr__lcd cod-vf-dslr__lcd--focal"
          aria-label={`Distancia focal ${focalLabel}`}
        >
          {focalLabel}
        </span>

        <span className="cod-vf-dslr__lcd cod-vf-dslr__lcd--aperture">{apertureLabel}</span>

        <span className="cod-vf-dslr__lcd cod-vf-dslr__lcd--shutter">{shutterLabel}</span>

        <span className="cod-vf-dslr__lcd cod-vf-dslr__lcd--wb">{wbLabel}</span>

        <div className="cod-vf-dslr__meter" aria-hidden="true">
          <div className="cod-vf-dslr__meter-scale">
            <span className="cod-vf-dslr__meter-sign">−</span>
            <span className="cod-vf-dslr__meter-num">2</span>
            <span className="cod-vf-dslr__meter-dot" />
            <span className="cod-vf-dslr__meter-dot" />
            <span className="cod-vf-dslr__meter-num">1</span>
            <span className="cod-vf-dslr__meter-dot" />
            <span className="cod-vf-dslr__meter-dot" />
            <span className="cod-vf-dslr__meter-zero">▼</span>
            <span className="cod-vf-dslr__meter-dot" />
            <span className="cod-vf-dslr__meter-dot" />
            <span className="cod-vf-dslr__meter-num">1</span>
            <span className="cod-vf-dslr__meter-dot" />
            <span className="cod-vf-dslr__meter-dot" />
            <span className="cod-vf-dslr__meter-sign">+</span>
            <span className="cod-vf-dslr__meter-num">2</span>
          </div>
          <div className="cod-vf-dslr__meter-track">
            {meterClippedUnder ? (
              <span
                className="cod-vf-dslr__meter-clip cod-vf-dslr__meter-clip--under"
                style={{ left: `${meterEvToTrackPercent(-METER_CLIP_EV)}%` }}
                aria-hidden="true"
                title="Subexposición fuera de escala"
              />
            ) : meterClippedOver ? (
              <span
                className="cod-vf-dslr__meter-clip cod-vf-dslr__meter-clip--over"
                style={{ left: `${meterEvToTrackPercent(METER_CLIP_EV)}%` }}
                aria-hidden="true"
                title="Sobreexposición fuera de escala"
              />
            ) : (
              <span className="cod-vf-dslr__meter-bar" style={{ left: `${barPercent}%` }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
