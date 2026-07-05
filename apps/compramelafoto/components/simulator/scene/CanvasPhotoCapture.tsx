"use client";

import { postprocessCapture, worldToCaptureRect } from "@/lib/simulator/capture-postprocess";
import { shutterSpeedToSeconds } from "@/lib/simulator/camera-math";
import {
  clampRendererExposure,
  computeShutterExposureGain,
  SCENE_RENDER_CALIBRATION,
} from "@/lib/simulator/camera-exposure";
import {
  COD_CAPTURE_FRAME_EVENT,
  COD_CAPTURE_IMAGE_EVENT,
  type CodCaptureFrameDetail,
  type CodCaptureImageDetail,
} from "@/lib/simulator/capture-events";
import {
  accumulatorToDataUrl,
  addFrameToAccumulatorShifted,
  createFrameAccumulator,
  getAccumulationPlan,
  getCapturePixelSize,
  type FrameAccumulator,
} from "@/lib/simulator/exposure-capture";
import {
  cropCanvasToViewfinderFrame,
  fullCanvasPixelToCapturePixel,
  getViewfinderCropRect,
} from "@/lib/simulator/viewfinder-frame";
import {
  computePanningAlignOffsetPx,
  computePanningMatch,
  isPanningAlignmentEligible,
  resolvePanningSubject,
  type PanningSample,
} from "@/lib/simulator/panning";
import { computeZoomDuringExposure, type ZoomSample } from "@/lib/simulator/zoom-exposure";
import { renderSimulatorFrame } from "@/lib/simulator/simulator-frame-renderer";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";

interface ActiveCapture {
  startMs: number;
  durationMs: number;
  intervalMs: number;
  nextSampleMs: number;
  useMotionBlur: boolean;
  accumulator: FrameAccumulator | null;
  scratchCanvas: HTMLCanvasElement;
  scratchCtx: CanvasRenderingContext2D;
  frameExposureMultiplier: number;
  shutterExposureGain: number;
  aperture: number;
  shutterSeconds: number;
  focusDistanceM: number;
  panningSamples: PanningSample[];
  zoomSamples: ZoomSample[];
}

const _proj = new THREE.Vector3();

function waitForGpuRender(gl: THREE.WebGLRenderer): void {
  gl.getContext().finish();
}

function projectWorldToCapturePixels(
  x: number,
  y: number,
  z: number,
  camera: THREE.Camera,
  width: number,
  height: number,
): { x: number; y: number; visible: boolean } | null {
  _proj.set(x, y, z);
  _proj.project(camera);
  if (_proj.z > 1) return null;
  return {
    x: ((_proj.x + 1) / 2) * width,
    y: ((1 - _proj.y) / 2) * height,
    visible: _proj.z >= -1 && _proj.z <= 1,
  };
}

/**
 * Captura el canvas con exposición real de la foto.
 * En exposiciones largas acumula fotogramas y aplica barrido + DOF en postproceso.
 */
export default function CanvasPhotoCapture() {
  const { gl, scene, camera } = useThree();
  const captureRef = useRef<ActiveCapture | null>(null);
  const busyRef = useRef(false);
  const loggedCaptureRef = useRef(false);

  const finishCapture = useCallback(
    async (capture: ActiveCapture | null, accumulator: FrameAccumulator | null, singleShot: boolean) => {
      try {
        let rawUrl = "";
        if (singleShot || !accumulator || accumulator.count === 0) {
          waitForGpuRender(gl);
          rawUrl = cropCanvasToViewfinderFrame(gl.domElement);
        } else {
          rawUrl = accumulatorToDataUrl(accumulator, capture?.shutterExposureGain ?? 1);
        }

        if (!rawUrl) return;

        const fullW = gl.domElement.width;
        const fullH = gl.domElement.height;
        const scaledSize = getCapturePixelSize(fullW, fullH);
        const capW = accumulator?.width ?? scaledSize.width;
        const capH = accumulator?.height ?? scaledSize.height;

        const subject = resolvePanningSubject();
        const subjectDepth =
          subject && camera
            ? Math.hypot(
                subject.position[0] - camera.position.x,
                subject.position[2] - camera.position.z,
              )
            : 5;

        const panning = computePanningMatch(
          capture?.panningSamples ?? [],
          subjectDepth,
          capW,
        );
        const zoom = computeZoomDuringExposure(capture?.zoomSamples ?? []);

        const subjectRect =
          subject && subject.visible
            ? worldToCaptureRect(
                subject.position[0],
                subject.position[1] + 0.9,
                subject.position[2],
                (wx, wy, wz) => {
                  const full = projectWorldToCapturePixels(wx, wy, wz, camera, fullW, fullH);
                  if (!full) return null;
                  const mapped = fullCanvasPixelToCapturePixel(
                    full.x,
                    full.y,
                    fullW,
                    fullH,
                    capW,
                    capH,
                  );
                  return { ...mapped, visible: full.visible };
                },
                capW,
                capH,
              )
            : null;

        const aperture =
          capture?.aperture ?? simulatorRuntime.derived?.effectiveSettings.aperture ?? 2.8;
        const shutterSeconds = capture?.shutterSeconds ?? 1 / 250;

        const { url, pedagogyNotes } = await postprocessCapture({
          sourceUrl: rawUrl,
          aperture,
          focalLengthMm: simulatorRuntime.focalLengthMm,
          shutterSeconds,
          panning,
          subjectScreenRect: subjectRect,
          zoom,
        });

        window.dispatchEvent(
          new CustomEvent<CodCaptureImageDetail>(COD_CAPTURE_IMAGE_EVENT, {
            detail: {
              url,
              pedagogyNotes,
              panningMatch: panning.detected ? panning.panningMatch : undefined,
              zoomChangedDuringExposure: zoom.zoomChangedDuringExposure,
              startFocalLength: zoom.startFocalLength,
              endFocalLength: zoom.endFocalLength,
            },
          }),
        );
      } catch {
        /* contexto WebGL no legible */
      } finally {
        const previewExposureMultiplier =
          simulatorRuntime.derived?.previewExposureMultiplier ?? SCENE_RENDER_CALIBRATION;
        gl.toneMappingExposure = clampRendererExposure(previewExposureMultiplier);
        renderSimulatorFrame(gl, scene, camera);
        captureRef.current = null;
        busyRef.current = false;
        simulatorRuntime.captureActive = false;
        simulatorRuntime.captureExposureGain = null;
        loggedCaptureRef.current = false;
        if (process.env.NODE_ENV === "development") {
          console.info("[Cam Of Duty] Capture inactive");
        }
      }
    },
    [gl, scene, camera],
  );

  const getSubjectScreenOnCapture = useCallback(
    (capW: number, capH: number) => {
      const subject = resolvePanningSubject();
      if (!subject?.visible) return null;

      const fullW = gl.domElement.width;
      const fullH = gl.domElement.height;
      const full = projectWorldToCapturePixels(
        subject.position[0],
        subject.position[1] + 0.9,
        subject.position[2],
        camera,
        fullW,
        fullH,
      );
      if (!full) return null;

      const mapped = fullCanvasPixelToCapturePixel(full.x, full.y, fullW, fullH, capW, capH);
      return { x: mapped.x, y: mapped.y, subject };
    },
    [camera, gl],
  );

  const recordPanningSample = useCallback(
    (capture: ActiveCapture, capW: number, capH: number) => {
      const screen = getSubjectScreenOnCapture(capW, capH);
      capture.panningSamples.push({
        timeMs: performance.now() - capture.startMs,
        cameraYaw: simulatorRuntime.getCameraYaw(),
        subjectX: screen?.subject.position[0] ?? 0,
        subjectScreenX: screen?.x,
        subjectScreenY: screen?.y,
      });
    },
    [getSubjectScreenOnCapture],
  );

  const recordZoomSample = useCallback((capture: ActiveCapture) => {
    capture.zoomSamples.push({
      timeMs: performance.now() - capture.startMs,
      focalLengthMm: simulatorRuntime.focalLengthMm,
    });
  }, []);

  const takeSample = useCallback(
    (capture: ActiveCapture) => {
      const canvas = gl.domElement;
      const crop = getViewfinderCropRect(canvas.width, canvas.height);
      const { width, height } = getCapturePixelSize(canvas.width, canvas.height);

      gl.toneMappingExposure = clampRendererExposure(capture.frameExposureMultiplier);
      simulatorRuntime.captureExposureGain =
        clampRendererExposure(capture.frameExposureMultiplier) / SCENE_RENDER_CALIBRATION;
      renderSimulatorFrame(gl, scene, camera);
      waitForGpuRender(gl);

      recordPanningSample(capture, width, height);
      recordZoomSample(capture);

      if (!capture.useMotionBlur) {
        void finishCapture(capture, null, true);
        return;
      }

      if (!capture.accumulator) {
        capture.accumulator = createFrameAccumulator(width, height);
        capture.scratchCanvas.width = width;
        capture.scratchCanvas.height = height;
      }

      capture.scratchCtx.drawImage(
        canvas,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        width,
        height,
      );
      const imageData = capture.scratchCtx.getImageData(0, 0, width, height);

      const screen = getSubjectScreenOnCapture(width, height);
      const alignOffset =
        screen && isPanningAlignmentEligible()
          ? computePanningAlignOffsetPx(
              capture.panningSamples,
              screen.x,
              simulatorRuntime.getCameraYaw(),
              width,
            )
          : 0;

      capture.accumulator = addFrameToAccumulatorShifted(
        capture.accumulator,
        imageData,
        alignOffset,
      );
    },
    [
      gl,
      scene,
      camera,
      finishCapture,
      recordPanningSample,
      recordZoomSample,
      getSubjectScreenOnCapture,
    ],
  );

  useEffect(() => {
    const onCaptureFrame = (event: Event) => {
      if (busyRef.current) return;

      const { shutterSpeed, aperture, focusDistanceM } = (
        event as CustomEvent<CodCaptureFrameDetail>
      ).detail;
      const derived = simulatorRuntime.derived;
      const shutterSeconds = shutterSpeedToSeconds(shutterSpeed);
      const { durationMs, intervalMs, useMotionBlur } = getAccumulationPlan(shutterSeconds);

      const photoExposureMultiplier = derived?.photoExposureMultiplier ?? SCENE_RENDER_CALIBRATION;
      const frameExposureMultiplier = useMotionBlur
        ? (derived?.instantPhotoExposureMultiplier ?? photoExposureMultiplier)
        : photoExposureMultiplier;
      const shutterExposureGain = useMotionBlur ? computeShutterExposureGain(shutterSeconds) : 1;

      const scratchCtx = document.createElement("canvas").getContext("2d", {
        willReadFrequently: true,
      });
      if (!scratchCtx) return;

      busyRef.current = true;
      simulatorRuntime.captureActive = true;
      simulatorRuntime.captureExposureGain =
        clampRendererExposure(frameExposureMultiplier) / SCENE_RENDER_CALIBRATION;
      if (process.env.NODE_ENV === "development" && !loggedCaptureRef.current) {
        loggedCaptureRef.current = true;
        console.info("[Cam Of Duty] Capture active");
      }
      const now = performance.now();
      const scratchCanvas = scratchCtx.canvas;

      captureRef.current = {
        startMs: now,
        durationMs,
        intervalMs,
        nextSampleMs: now,
        useMotionBlur,
        accumulator: null,
        scratchCanvas,
        scratchCtx,
        frameExposureMultiplier,
        shutterExposureGain,
        aperture,
        shutterSeconds,
        focusDistanceM,
        panningSamples: [],
        zoomSamples: [],
      };

      recordZoomSample(captureRef.current);

      if (!useMotionBlur) {
        takeSample(captureRef.current);
      }
    };

    window.addEventListener(COD_CAPTURE_FRAME_EVENT, onCaptureFrame);
    return () => window.removeEventListener(COD_CAPTURE_FRAME_EVENT, onCaptureFrame);
  }, [takeSample, recordPanningSample, recordZoomSample, gl]);

  useFrame(() => {
    const capture = captureRef.current;
    if (!capture?.useMotionBlur) return;

    const now = performance.now();
    const elapsed = now - capture.startMs;

    if (elapsed >= capture.durationMs) {
      void finishCapture(capture, capture.accumulator, false);
      return;
    }

    if (now >= capture.nextSampleMs) {
      takeSample(capture);
      capture.nextSampleMs = now + capture.intervalMs;
    }
  });

  return null;
}
