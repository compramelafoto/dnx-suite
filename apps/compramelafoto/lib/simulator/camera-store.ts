"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  buildExposureDebugSnapshot,
  classifyExposure,
  computeMeasuredEv,
  computeInstantPhotoExposureMultiplier,
  computePhotoExposureMultiplier,
  computePreviewExposureMultiplier,
  formatCaptureEvLabel,
  histogramBiasFromMeter,
  resolveEffectiveSettings,
  type CaptureResult,
  type CompositionGuideMode,
  type PhotoStarRating,
  type ViewfinderMode,
} from "./camera-exposure";
import { COD_CAPTURE_IMAGE_EVENT, type CodCaptureImageDetail } from "./capture-events";
import {
  COD_FOCUS_PROGRESS_EVENT,
  COD_FOCUS_REQUEST_EVENT,
  COD_FOCUS_TRACKING_EVENT,
  COD_FOCUS_UPDATED_EVENT,
  type CodFocusProgressDetail,
  type CodFocusTrackingDetail,
  type CodFocusUpdatedDetail,
} from "./focus-events";
import { areaFeedbackLabel, cycleFocusAreaIndex, FOCUS_POINT_DEFAULT_INDEX } from "./focus-math";
import {
  DEFAULT_FOCUS_STATE,
  focusModeToLabel,
  type FocusAreaMode,
  type FocusMode,
  type FocusState,
} from "./focus-types";
import type { CaptureUserInfo } from "./capture-metadata";
import type { SimulatorSceneId } from "./scenes";
import {
  computeSunState,
  DEFAULT_TIME_OF_DAY_MINUTES,
  clampTimeOfDayMinutes,
  type SunState,
} from "./natural-light";
import { computeWhiteBalanceTint, formatEvLabel } from "./camera-math";
import type { CameraDerivedValues, CameraMode, CameraState } from "./camera-types";
import {
  APERTURE_PRESETS,
  ISO_PRESETS,
  MODE_PRESETS,
  REFERENCE_CAMERA,
  SHUTTER_PRESETS,
  WB_PRESETS,
} from "./camera-types";
import {
  definitionToActiveState,
  getDefaultLens,
  getMaxApertureAtFocal,
  getLensById,
  stepLensFocal,
  type ActiveLensState,
} from "./lenses";
import { simulatorRuntime, syncMovingSubjectsRegistry } from "./simulator-runtime";

export interface CameraStoreValue {
  settings: CameraState;
  lens: ActiveLensState;
  derived: CameraDerivedValues;
  sceneLuminanceEv: number;
  sceneId: SimulatorSceneId;
  timeOfDayMinutes: number;
  sunState: SunState;
  viewfinderMode: ViewfinderMode;
  compositionGuide: CompositionGuideMode;
  showHistogram: boolean;
  lastCapture: CaptureResult | null;
  gallery: CaptureResult[];
  presets: {
    iso: readonly number[];
    shutter: readonly string[];
    aperture: readonly number[];
    whiteBalance: readonly number[];
    modes: readonly CameraMode[];
  };
  setIso: (iso: number) => void;
  setShutterSpeed: (shutterSpeed: string) => void;
  setAperture: (aperture: number) => void;
  setWhiteBalance: (kelvin: number) => void;
  setMode: (mode: CameraMode) => void;
  setExposureCompensation: (value: number) => void;
  adjustExposureCompensation: (delta: number) => void;
  selectLens: (lensId: string) => void;
  setLensFocalLength: (focalLengthMm: number) => void;
  stepLensZoom: (delta: -1 | 1) => void;
  setViewfinderMode: (mode: ViewfinderMode) => void;
  setCompositionGuide: (guide: CompositionGuideMode) => void;
  setShowHistogram: (show: boolean) => void;
  setSceneLuminanceEv: (ev: number) => void;
  setSceneId: (sceneId: SimulatorSceneId) => void;
  setTimeOfDayMinutes: (minutes: number) => void;
  setPhotoStars: (id: number, stars: PhotoStarRating) => void;
  hydrateGallery: (items: CaptureResult[]) => void;
  patchCapture: (id: number, patch: Partial<CaptureResult>) => void;
  sessionUser: CaptureUserInfo | null;
  setSessionUser: (user: CaptureUserInfo | null) => void;
  focus: FocusState;
  setFocusMode: (mode: FocusMode) => void;
  setFocusAreaMode: (mode: FocusAreaMode) => void;
  cycleFocusArea: () => void;
  triggerAutofocus: (source?: "center" | "click" | "keyboard") => void;
  setContinuousFocusActive: (active: boolean) => void;
  resetFocusToCenter: () => void;
  requestFocus: (source: "center" | "click") => void;
  capturePhoto: () => CaptureResult;
}

const CameraContext = createContext<CameraStoreValue | null>(null);

function clampApertureForLens(aperture: number, lens: ActiveLensState): number {
  const def = getLensById(lens.lensId);
  if (!def) return aperture;
  const maxOpen = getMaxApertureAtFocal(def, lens.focalLengthMm);
  if (aperture >= maxOpen) return aperture;
  const nextPreset = APERTURE_PRESETS.find((value) => value >= maxOpen);
  return nextPreset ?? maxOpen;
}

function syncSettingsWithLens(
  prev: CameraState,
  lens: ActiveLensState,
): { settings: CameraState; lens: ActiveLensState } {
  const aperture = clampApertureForLens(prev.aperture, lens);
  return {
    lens,
    settings: {
      ...prev,
      focalLengthMm: lens.focalLengthMm,
      aperture,
    },
  };
}

function deriveValues(
  settings: CameraState,
  sceneLuminanceEv: number,
  viewfinderMode: ViewfinderMode,
): CameraDerivedValues {
  const effectiveSettings = resolveEffectiveSettings(settings, sceneLuminanceEv);
  const measuredEv = computeMeasuredEv(effectiveSettings, sceneLuminanceEv);
  const meterNeedleEv = Math.max(-3, Math.min(3, measuredEv - settings.exposureCompensation));
  const previewExposureMultiplier = computePreviewExposureMultiplier(
    settings,
    sceneLuminanceEv,
    viewfinderMode,
  );
  const photoExposureMultiplier = computePhotoExposureMultiplier(settings, sceneLuminanceEv);
  const instantPhotoExposureMultiplier = computeInstantPhotoExposureMultiplier(
    settings,
    sceneLuminanceEv,
  );
  const exposureVerdict = classifyExposure(measuredEv);

  const exposureDebug = buildExposureDebugSnapshot(
    settings,
    sceneLuminanceEv,
    viewfinderMode,
    {
      measuredEv,
      meterNeedleEv,
      previewExposureMultiplier,
      photoExposureMultiplier,
    },
    simulatorRuntime.appliedToneMappingExposure,
  );

  return {
    effectiveSettings,
    previewExposureMultiplier,
    photoExposureMultiplier,
    instantPhotoExposureMultiplier,
    measuredEv,
    meterNeedleEv,
    exposureVerdict,
    evLabel: formatEvLabel(meterNeedleEv),
    captureEvLabel: formatCaptureEvLabel(measuredEv),
    wbTint: computeWhiteBalanceTint(settings.whiteBalance),
    histogramBias: histogramBiasFromMeter(measuredEv),
    exposureMultiplier: previewExposureMultiplier,
    exposureValue: meterNeedleEv,
    exposureDebug,
  };
}

export function CameraProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CameraState>(REFERENCE_CAMERA);
  const [lens, setLens] = useState<ActiveLensState>(() =>
    definitionToActiveState(getDefaultLens()),
  );
  const [sceneLuminanceEv, setSceneLuminanceEvState] = useState(0);
  const [sceneId, setSceneIdState] = useState<SimulatorSceneId>("studio");
  const [timeOfDayMinutes, setTimeOfDayMinutesState] = useState(DEFAULT_TIME_OF_DAY_MINUTES);
  const [viewfinderMode, setViewfinderMode] = useState<ViewfinderMode>("dslr-view");
  const [compositionGuide, setCompositionGuide] = useState<CompositionGuideMode>("thirds");
  const [showHistogram, setShowHistogram] = useState(false);
  const [lastCapture, setLastCapture] = useState<CaptureResult | null>(null);
  const [gallery, setGallery] = useState<CaptureResult[]>([]);
  const [focus, setFocus] = useState<FocusState>(DEFAULT_FOCUS_STATE);
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const [sessionUser, setSessionUser] = useState<CaptureUserInfo | null>(null);
  const captureIdRef = useRef(0);

  useEffect(() => {
    const onCaptureImage = (event: Event) => {
      const {
        url,
        pedagogyNotes,
        panningMatch,
        zoomChangedDuringExposure,
        startFocalLength,
        endFocalLength,
      } = (event as CustomEvent<CodCaptureImageDetail>).detail;
      setLastCapture((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          previewUrl: url,
          pedagogyNotes,
          panningMatch,
          zoomChangedDuringExposure,
          startFocalLength,
          endFocalLength,
          takenBy: sessionUser ?? prev.takenBy,
        };
        setGallery((items) => items.map((item) => (item.id === prev.id ? updated : item)));
        return updated;
      });
    };

    window.addEventListener(COD_CAPTURE_IMAGE_EVENT, onCaptureImage);
    return () => window.removeEventListener(COD_CAPTURE_IMAGE_EVENT, onCaptureImage);
  }, [sessionUser]);

  useEffect(() => {
    const onFocusProgress = (event: Event) => {
      const { distanceM } = (event as CustomEvent<CodFocusProgressDetail>).detail;
      setFocus((prev) => ({ ...prev, distanceM }));
    };

    const onFocusTracking = (event: Event) => {
      const detail = (event as CustomEvent<CodFocusTrackingDetail>).detail;
      setFocus((prev) => ({
        ...prev,
        distanceM: detail.distanceM,
        focusTargetWorldPosition: detail.worldPoint,
        focusConfidence: detail.focusConfidence,
        focusedObjectId: detail.focusedObjectId,
        status: "TRACKING",
        targetLabel: "Sujeto",
        isFocusing: false,
      }));
    };

    const onFocusUpdated = (event: Event) => {
      const detail = (event as CustomEvent<CodFocusUpdatedDetail>).detail;
      setFocus((prev) => ({
        ...prev,
        distanceM: detail.distanceM,
        targetLabel: detail.targetLabel,
        focusTargetWorldPosition: detail.worldPoint,
        focusConfidence: detail.focusConfidence,
        focusedObjectId: detail.focusedObjectId,
        focusLocked: detail.focusLocked,
        status: detail.status,
        isFocusing: false,
        lockedAtMs: Date.now(),
      }));
    };

    window.addEventListener(COD_FOCUS_PROGRESS_EVENT, onFocusProgress);
    window.addEventListener(COD_FOCUS_TRACKING_EVENT, onFocusTracking);
    window.addEventListener(COD_FOCUS_UPDATED_EVENT, onFocusUpdated);
    return () => {
      window.removeEventListener(COD_FOCUS_PROGRESS_EVENT, onFocusProgress);
      window.removeEventListener(COD_FOCUS_TRACKING_EVENT, onFocusTracking);
      window.removeEventListener(COD_FOCUS_UPDATED_EVENT, onFocusUpdated);
    };
  }, []);

  const derived = useMemo(
    () => deriveValues(settings, sceneLuminanceEv, viewfinderMode),
    [settings, sceneLuminanceEv, viewfinderMode],
  );

  const sunState = useMemo(
    () => computeSunState(timeOfDayMinutes),
    [timeOfDayMinutes],
  );

  const setIso = useCallback((iso: number) => {
    const valid = (ISO_PRESETS as readonly number[]).includes(iso) ? iso : REFERENCE_CAMERA.iso;
    setSettings((prev) => ({ ...prev, iso: valid }));
  }, []);

  const setShutterSpeed = useCallback((shutterSpeed: string) => {
    setSettings((prev) => {
      if (prev.mode === "A") return prev;
      return { ...prev, shutterSpeed };
    });
  }, []);

  const setAperture = useCallback((aperture: number) => {
    setSettings((prev) => {
      if (prev.mode === "S") return prev;
      return { ...prev, aperture };
    });
  }, []);

  const selectLens = useCallback((lensId: string) => {
    const def = getLensById(lensId);
    if (!def) return;
    const nextLens = definitionToActiveState(def);
    setLens(nextLens);
    simulatorRuntime.focalLengthMm = nextLens.focalLengthMm;
    simulatorRuntime.lensName = nextLens.lensName;
    simulatorRuntime.isZoomLens = nextLens.isZoomLens;
    setSettings((prev) => syncSettingsWithLens(prev, nextLens).settings);
  }, []);

  const setLensFocalLength = useCallback((focalLengthMm: number) => {
    setLens((prev) => {
      const nextFocal = Math.round(
        Math.min(prev.maxFocalLengthMm, Math.max(prev.minFocalLengthMm, focalLengthMm)),
      );
      const nextLens = { ...prev, focalLengthMm: nextFocal };
      const def = getLensById(prev.lensId);
      if (def) {
        nextLens.maxAperture = getMaxApertureAtFocal(def, nextFocal);
      }
      simulatorRuntime.focalLengthMm = nextFocal;
      setSettings((s) => syncSettingsWithLens(s, nextLens).settings);
      return nextLens;
    });
  }, []);

  const stepLensZoom = useCallback((delta: -1 | 1) => {
    setLens((prev) => {
      if (!prev.isZoomLens) return prev;
      const nextFocal = stepLensFocal(prev, delta);
      if (nextFocal === prev.focalLengthMm) return prev;
      const nextLens = { ...prev, focalLengthMm: nextFocal };
      const def = getLensById(prev.lensId);
      if (def) {
        nextLens.maxAperture = getMaxApertureAtFocal(def, nextFocal);
      }
      simulatorRuntime.focalLengthMm = nextFocal;
      setSettings((s) => syncSettingsWithLens(s, nextLens).settings);
      return nextLens;
    });
  }, []);

  const setWhiteBalance = useCallback((whiteBalance: number) => {
    setSettings((prev) => ({ ...prev, whiteBalance }));
  }, []);

  const setMode = useCallback((mode: CameraMode) => {
    setSettings((prev) => ({ ...prev, mode }));
  }, []);

  const adjustExposureCompensation = useCallback((delta: number) => {
    setSettings((prev) => ({
      ...prev,
      exposureCompensation: Math.min(3, Math.max(-3, prev.exposureCompensation + delta)),
    }));
  }, []);

  const setExposureCompensation = useCallback((value: number) => {
    setSettings((prev) => ({
      ...prev,
      exposureCompensation: Math.min(3, Math.max(-3, value)),
    }));
  }, []);

  const setSceneLuminanceEv = useCallback((ev: number) => {
    setSceneLuminanceEvState((prev) => (Math.abs(prev - ev) < 0.04 ? prev : ev));
  }, []);

  const setSceneId = useCallback((next: SimulatorSceneId) => {
    setSceneIdState(next);
    syncMovingSubjectsRegistry([]);
  }, []);

  const setTimeOfDayMinutes = useCallback((minutes: number) => {
    setTimeOfDayMinutesState(clampTimeOfDayMinutes(minutes));
  }, []);

  const setPhotoStars = useCallback((id: number, stars: PhotoStarRating) => {
    const valid = Math.min(5, Math.max(0, Math.round(stars))) as PhotoStarRating;
    setGallery((items) =>
      items.map((item) => (item.id === id ? { ...item, stars: valid } : item)),
    );
    setLastCapture((prev) => (prev?.id === id ? { ...prev, stars: valid } : prev));
  }, []);

  const hydrateGallery = useCallback((items: CaptureResult[]) => {
    setGallery(items);
    setLastCapture(items.length ? items[items.length - 1] : null);
    captureIdRef.current = items.reduce((max, item) => Math.max(max, item.id), 0);
  }, []);

  const patchCapture = useCallback((id: number, patch: Partial<CaptureResult>) => {
    setGallery((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setLastCapture((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  }, []);

  const triggerAutofocus = useCallback((source: "center" | "click" | "keyboard" = "keyboard") => {
    const current = focusRef.current;
    if (current.focusMode === "MF") return;

    window.dispatchEvent(
      new CustomEvent(COD_FOCUS_REQUEST_EVENT, {
        detail: {
          source,
          focusAreaMode: current.focusAreaMode,
          activeFocusPointIndex: current.activeFocusPointIndex,
        },
      }),
    );

    setFocus((prev) => ({
      ...prev,
      isFocusing: true,
      status: "SEARCHING",
      focusLocked: false,
      areaFeedback: null,
    }));
  }, []);

  const setFocusMode = useCallback((focusMode: FocusMode) => {
    setFocus((prev) => ({
      ...prev,
      focusMode,
      focusLocked: focusMode === "AF_S" ? prev.focusLocked : false,
      continuousFocusActive: focusMode === "MF" ? false : prev.continuousFocusActive,
    }));
  }, []);

  const setFocusAreaMode = useCallback((focusAreaMode: FocusAreaMode) => {
    setFocus((prev) => ({
      ...prev,
      focusAreaMode,
      activeFocusPointIndex: focusAreaMode === "POINT" ? FOCUS_POINT_DEFAULT_INDEX : 0,
    }));
  }, []);

  const cycleFocusArea = useCallback(() => {
    setFocus((prev) => {
      const nextIndex = cycleFocusAreaIndex(prev.focusAreaMode, prev.activeFocusPointIndex);
      return {
        ...prev,
        activeFocusPointIndex: nextIndex,
        areaFeedback: areaFeedbackLabel(prev.focusAreaMode, nextIndex),
      };
    });
  }, []);

  const setContinuousFocusActive = useCallback((active: boolean) => {
    setFocus((prev) => ({
      ...prev,
      continuousFocusActive: active,
      status:
        !active && prev.status === "TRACKING"
          ? "FOCUS_OK"
          : active && prev.focusMode === "AF_C" && prev.focusedObjectId
            ? "TRACKING"
            : prev.status,
    }));
    simulatorRuntime.continuousFocusActive = active;
  }, []);

  const requestFocus = useCallback(
    (source: "center" | "click") => {
      triggerAutofocus(source);
    },
    [triggerAutofocus],
  );

  const resetFocusToCenter = useCallback(() => {
    setFocus((prev) => ({
      ...prev,
      focusAreaMode: "POINT",
      activeFocusPointIndex: FOCUS_POINT_DEFAULT_INDEX,
    }));
    triggerAutofocus("center");
  }, [triggerAutofocus]);

  const capturePhoto = useCallback((): CaptureResult => {
    const effectiveSettings = resolveEffectiveSettings(settings, sceneLuminanceEv);
    const measuredEv = computeMeasuredEv(effectiveSettings, sceneLuminanceEv);
    const result: CaptureResult = {
      id: ++captureIdRef.current,
      timestamp: Date.now(),
      settings: { ...effectiveSettings, exposureCompensation: settings.exposureCompensation },
      measuredEv,
      verdict: classifyExposure(measuredEv),
      evLabel: formatCaptureEvLabel(measuredEv),
      stars: 0,
      takenBy: sessionUser ?? undefined,
      focus: {
        mode: focusModeToLabel(focus.focusMode),
        distanceM: focus.distanceM,
        targetLabel: focus.targetLabel,
      },
      viewfinderMode,
      sceneId,
      sceneLuminanceEv,
    };
    setLastCapture(result);
    setGallery((items) => [...items, result]);
    return result;
  }, [settings, sceneLuminanceEv, sessionUser, focus, viewfinderMode, sceneId]);

  const value = useMemo<CameraStoreValue>(
    () => ({
      settings,
      lens,
      derived,
      sceneLuminanceEv,
      sceneId,
      timeOfDayMinutes,
      sunState,
      viewfinderMode,
      compositionGuide,
      showHistogram,
      lastCapture,
      gallery,
      presets: {
        iso: ISO_PRESETS,
        shutter: SHUTTER_PRESETS,
        aperture: APERTURE_PRESETS,
        whiteBalance: WB_PRESETS,
        modes: MODE_PRESETS,
      },
      setIso,
      setShutterSpeed,
      setAperture,
      setWhiteBalance,
      setMode,
      setExposureCompensation,
      adjustExposureCompensation,
      selectLens,
      setLensFocalLength,
      stepLensZoom,
      setViewfinderMode,
      setCompositionGuide,
      setShowHistogram,
      setSceneLuminanceEv,
      setSceneId,
      setTimeOfDayMinutes,
      setPhotoStars,
      hydrateGallery,
      patchCapture,
      sessionUser,
      setSessionUser,
      focus,
      setFocusMode,
      setFocusAreaMode,
      cycleFocusArea,
      triggerAutofocus,
      setContinuousFocusActive,
      resetFocusToCenter,
      requestFocus,
      capturePhoto,
    }),
    [
      settings,
      lens,
      derived,
      sceneLuminanceEv,
      sceneId,
      timeOfDayMinutes,
      sunState,
      viewfinderMode,
      compositionGuide,
      showHistogram,
      lastCapture,
      gallery,
      focus,
      setIso,
      setShutterSpeed,
      setAperture,
      setWhiteBalance,
      setMode,
      setExposureCompensation,
      adjustExposureCompensation,
      selectLens,
      setLensFocalLength,
      stepLensZoom,
      setViewfinderMode,
      setCompositionGuide,
      setShowHistogram,
      setSceneLuminanceEv,
      setSceneId,
      setTimeOfDayMinutes,
      setPhotoStars,
      hydrateGallery,
      patchCapture,
      sessionUser,
      setFocusMode,
      setFocusAreaMode,
      cycleFocusArea,
      triggerAutofocus,
      setContinuousFocusActive,
      resetFocusToCenter,
      requestFocus,
      capturePhoto,
    ],
  );

  return createElement(CameraContext.Provider, { value }, children);
}

export function useCameraStore(): CameraStoreValue {
  const ctx = useContext(CameraContext);
  if (!ctx) {
    throw new Error("useCameraStore debe usarse dentro de CameraProvider");
  }
  return ctx;
}
