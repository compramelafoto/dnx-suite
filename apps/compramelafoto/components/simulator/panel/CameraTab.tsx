"use client";

import CameraParamTimeline from "@/components/simulator/CameraParamTimeline";
import {
  CameraOptionBtn,
  CameraOptionStepper,
  CameraParamOptionRow,
} from "@/components/simulator/CameraParamOptionRow";
import {
  DEFAULT_COMPOSITION_GUIDE,
  DEFAULT_VIEWFINDER_MODE,
  EXPOSURE_COMP_PRESETS,
} from "@/lib/simulator/camera-defaults";
import {
  formatAperture,
  formatShutterSpeed,
  formatWhiteBalance,
  MODE_UI_TITLES,
  UI_LABEL_EXPOSURE_TIME,
  UI_LABEL_EXPOSURE_TIME_AUTO,
} from "@/lib/simulator/camera-settings";
import { useCameraStore } from "@/lib/simulator/camera-store";
import { REFERENCE_CAMERA } from "@/lib/simulator/camera-types";
import type { FocusAreaMode, FocusMode } from "@/lib/simulator/focus-types";
import { focusModeToLabel } from "@/lib/simulator/focus-types";
import Button from "@/components/ui/Button";
import { useEffect, useRef } from "react";

const FOCUS_MODES: { id: FocusMode; title: string }[] = [
  { id: "AF_S", title: "Enfoca una vez y bloquea" },
  { id: "AF_C", title: "Foco continuo sobre el área activa" },
  { id: "MF", title: "Manual (sin autofocus)" },
];

const FOCUS_AREAS: { id: FocusAreaMode; label: string; title: string }[] = [
  { id: "POINT", label: "Punto", title: "Punto central preciso" },
  { id: "ZONE", label: "Zona", title: "Grilla 3×3, una zona activa" },
  { id: "WIDE", label: "Amplia", title: "Área grande del visor" },
];

function formatComp(value: number): string {
  if (value === 0) return "0";
  return value > 0 ? `+${value}` : String(value);
}

export interface CameraTabProps {
  activeIndex: number;
}

export default function CameraTab({ activeIndex }: CameraTabProps) {
  const {
    settings,
    derived,
    presets,
    viewfinderMode,
    compositionGuide,
    showHistogram,
    focus,
    setIso,
    setShutterSpeed,
    setAperture,
    setWhiteBalance,
    setMode,
    setExposureCompensation,
    adjustExposureCompensation,
    setViewfinderMode,
    setCompositionGuide,
    setShowHistogram,
    setFocusMode,
    setFocusAreaMode,
    triggerAutofocus,
    resetFocusToCenter,
  } = useCameraStore();

  const paramRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { effectiveSettings } = derived;

  useEffect(() => {
    paramRefs.current[activeIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  const setParamRef = (index: number) => (el: HTMLDivElement | null) => {
    paramRefs.current[index] = el;
  };

  const shutterAuto = settings.mode === "A";
  const apertureAuto = settings.mode === "S";
  const compMin = settings.exposureCompensation <= EXPOSURE_COMP_PRESETS[0];
  const compMax =
    settings.exposureCompensation >= EXPOSURE_COMP_PRESETS[EXPOSURE_COMP_PRESETS.length - 1];

  return (
    <div
      className="cod-side-panel"
      role="tabpanel"
      id="cod-side-panel-camera"
      aria-labelledby="cod-side-tab-camera"
    >
      <div className="cod-param-form cod-param-form--compact">
        <div ref={setParamRef(0)}>
          <CameraParamTimeline
            id="cod-iso"
            label="ISO"
            variant="iso"
            value={settings.iso}
            options={presets.iso}
            onChange={setIso}
            formatValue={(v) => String(v)}
            focused={activeIndex === 0}
            resettable
            onReset={() => setIso(REFERENCE_CAMERA.iso)}
          />
        </div>

        <div ref={setParamRef(1)}>
          <CameraParamTimeline
            id="cod-shutter"
            label={shutterAuto ? UI_LABEL_EXPOSURE_TIME_AUTO : UI_LABEL_EXPOSURE_TIME}
            variant="shutter"
            value={shutterAuto ? effectiveSettings.shutterSpeed : settings.shutterSpeed}
            options={presets.shutter}
            onChange={setShutterSpeed}
            formatValue={formatShutterSpeed}
            scaleDirection="desc"
            focused={activeIndex === 1}
            readOnly={shutterAuto}
          />
        </div>

        <div ref={setParamRef(2)}>
          <CameraParamTimeline
            id="cod-aperture"
            label={apertureAuto ? "Diafragma (auto)" : "Diafragma"}
            variant="aperture"
            value={apertureAuto ? effectiveSettings.aperture : settings.aperture}
            options={presets.aperture}
            onChange={setAperture}
            formatValue={formatAperture}
            focused={activeIndex === 2}
            readOnly={apertureAuto}
          />
        </div>

        <div ref={setParamRef(3)}>
          <CameraParamTimeline
            id="cod-wb"
            label="WB"
            variant="wb"
            value={settings.whiteBalance}
            options={presets.whiteBalance}
            onChange={setWhiteBalance}
            formatValue={formatWhiteBalance}
            focused={activeIndex === 3}
            resettable
            onReset={() => setWhiteBalance(REFERENCE_CAMERA.whiteBalance)}
          />
        </div>
      </div>

      <div className="cod-param-divider" aria-hidden="true" />

      <h3 className="cod-panel__subtitle">Enfoque</h3>
      <div className="cod-param-form cod-param-form--compact cod-focus-panel">
        <CameraParamOptionRow label="Modo de enfoque">
          {FOCUS_MODES.map((item) => (
            <CameraOptionBtn
              key={item.id}
              active={focus.focusMode === item.id}
              onClick={() => setFocusMode(item.id)}
              aria-label={focusModeToLabel(item.id)}
              title={item.title}
            >
              {focusModeToLabel(item.id)}
            </CameraOptionBtn>
          ))}
        </CameraParamOptionRow>

        <CameraParamOptionRow label="Área de enfoque">
          {FOCUS_AREAS.map((item) => (
            <CameraOptionBtn
              key={item.id}
              active={focus.focusAreaMode === item.id}
              onClick={() => setFocusAreaMode(item.id)}
              aria-label={item.label}
              title={item.title}
            >
              {item.label}
            </CameraOptionBtn>
          ))}
        </CameraParamOptionRow>

        <div className="cod-focus-panel__row">
          <span className="cod-focus-panel__label">Plano de enfoque</span>
          <span className="cod-focus-panel__value">{focus.distanceM.toFixed(1)} m</span>
        </div>
        <div className="cod-focus-panel__row">
          <span className="cod-focus-panel__label">Confianza</span>
          <span className="cod-focus-panel__value">{Math.round(focus.focusConfidence * 100)}%</span>
        </div>
        <div className="cod-focus-panel__row">
          <span className="cod-focus-panel__label">Mira AF</span>
          <span className="cod-focus-panel__value">{focus.targetLabel}</span>
        </div>

        <Button
          variant="secondary"
          size="md"
          type="button"
          className="w-full"
          disabled={focus.focusMode === "MF"}
          onClick={() => triggerAutofocus("keyboard")}
        >
          Enfocar (C)
        </Button>
        <Button variant="secondary" size="md" type="button" className="w-full" onClick={resetFocusToCenter}>
          Reset a centro
        </Button>

        <p className="cod-focus-panel__hint">
          <kbd>V</kbd> cambia punto/área AF · <kbd>C</kbd> enfoca · Mantener <kbd>C</kbd> = foco continuo
          en AF-C
        </p>
        <p className="cod-focus-panel__hint cod-focus-panel__hint--muted">
          AF-S: una toma y bloquea · AF-C: seguimiento con C presionada · MF: sin autofocus
        </p>
      </div>

      <div className="cod-param-divider" aria-hidden="true" />

      <h3 className="cod-panel__subtitle">Opciones</h3>

      <div className="cod-param-options">
        <div ref={setParamRef(4)}>
          <CameraParamOptionRow
            label="Modo"
            focused={activeIndex === 4}
            resettable
            onReset={() => setMode("M")}
          >
            {presets.modes.map((mode) => (
              <CameraOptionBtn
                key={mode}
                active={settings.mode === mode}
                onClick={() => setMode(mode)}
                aria-label={MODE_UI_TITLES[mode]}
                title={MODE_UI_TITLES[mode]}
              >
                {mode}
              </CameraOptionBtn>
            ))}
          </CameraParamOptionRow>
        </div>

        <div ref={setParamRef(5)}>
          <CameraParamOptionRow
            label="Comp."
            focused={activeIndex === 5}
            resettable
            onReset={() => setExposureCompensation(0)}
          >
            <CameraOptionStepper
              value={formatComp(settings.exposureCompensation)}
              onDecrease={() => adjustExposureCompensation(-0.5)}
              onIncrease={() => adjustExposureCompensation(0.5)}
              decreaseDisabled={compMin}
              increaseDisabled={compMax}
            />
          </CameraParamOptionRow>
        </div>

        <div ref={setParamRef(6)}>
          <CameraParamOptionRow
            label="Visor"
            focused={activeIndex === 6}
            resettable
            onReset={() => setViewfinderMode(DEFAULT_VIEWFINDER_MODE)}
          >
            <CameraOptionBtn
              active={viewfinderMode === "live-view"}
              onClick={() => setViewfinderMode("live-view")}
              aria-label="Live View"
            >
              LIVE
            </CameraOptionBtn>
            <CameraOptionBtn
              active={viewfinderMode === "dslr-view"}
              onClick={() => setViewfinderMode("dslr-view")}
              aria-label="DSLR View"
            >
              DSLR
            </CameraOptionBtn>
          </CameraParamOptionRow>
        </div>

        <div ref={setParamRef(7)}>
          <CameraParamOptionRow
            label="Display"
            variant="display"
            focused={activeIndex === 7}
            resettable
            onReset={() => {
              setCompositionGuide(DEFAULT_COMPOSITION_GUIDE);
              setShowHistogram(false);
            }}
          >
            <CameraOptionBtn
              active={compositionGuide === "none"}
              onClick={() => setCompositionGuide("none")}
              aria-label="Sin guías"
              title="Sin guías"
            >
              Sin
            </CameraOptionBtn>
            <CameraOptionBtn
              active={compositionGuide === "thirds"}
              onClick={() => setCompositionGuide("thirds")}
              aria-label="Regla de tercios"
              title="Regla de tercios"
            >
              Tercios
            </CameraOptionBtn>
            <CameraOptionBtn
              active={compositionGuide === "center"}
              onClick={() => setCompositionGuide("center")}
              aria-label="Guía de centro"
              title="Guía de centro"
            >
              Centro
            </CameraOptionBtn>
            <CameraOptionBtn
              active={showHistogram}
              onClick={() => setShowHistogram(!showHistogram)}
              aria-label={showHistogram ? "Histograma activado" : "Histograma desactivado"}
              title="Histograma"
            >
              Hist
            </CameraOptionBtn>
          </CameraParamOptionRow>
        </div>
      </div>
    </div>
  );
}
