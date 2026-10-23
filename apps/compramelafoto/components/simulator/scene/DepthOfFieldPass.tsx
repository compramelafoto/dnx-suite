"use client";

import {
  DOF_FRAGMENT_SHADER,
  DOF_VERTEX_SHADER,
  dofRadiusScale,
} from "@/lib/simulator/dof-shaders";
import {
  clampRendererExposure,
  resolveActiveExposureGain,
  SCENE_RENDER_CALIBRATION,
  shouldApplyWhiteBalanceToRender,
} from "@/lib/simulator/camera-exposure";
import { applyToneMappingToRenderer, usesPhotographicPipeline } from "@/lib/simulator/render";
import { calculateSceneMaxBlurPx } from "@/lib/simulator/depth-of-field";
import { getActiveSensor } from "@/lib/simulator/sensor";
import { isoNoiseFactor } from "@/lib/simulator/sensor-noise";
import { canvasSensorHeightMm, computeViewfinderInsets } from "@/lib/simulator/viewfinder-frame";
import { readAllModes, smoothReadings, type MeterReadings } from "@/lib/simulator/metering";
import { AO_FRAGMENT_SHADER, AO_RADIUS_M, AO_STRENGTH } from "@/lib/simulator/ao-shader";
import {
  METER_DOWNSAMPLE_FRAGMENT_SHADER,
  METER_GRID_HEIGHT,
  METER_GRID_WIDTH,
  METER_INTERVAL_MS,
} from "@/lib/simulator/meter-shader";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import {
  registerSimulatorFrameRenderer,
  type SimulatorFrameRenderer,
} from "@/lib/simulator/simulator-frame-renderer";
import { useFBO } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Renderiza la escena con DOF por distancia (plano de enfoque).
 * Disco de desenfoque físico en px: f/1.4 desenfoca el doble que f/2.8.
 */
export default function DepthOfFieldPass() {
  const { gl, scene, camera, size } = useThree();
  const fbo = useFBO({ depthBuffer: true });
  const quadScene = useRef(new THREE.Scene());
  const orthoCam = useRef(new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
  const invProj = useRef(new THREE.Matrix4());

  const dofMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: DOF_VERTEX_SHADER,
      fragmentShader: DOF_FRAGMENT_SHADER,
      uniforms: {
        tColor: { value: null as THREE.Texture | null },
        tDepth: { value: null as THREE.Texture | null },
        focusDistance: { value: 6.5 },
        aperture: { value: 2.8 },
        focalLength: { value: 50 },
        sensorHeightMm: { value: getActiveSensor().heightMm },
        cameraInverseProjection: { value: new THREE.Matrix4() },
        resolution: { value: new THREE.Vector2(1, 1) },
        maxBlurPx: { value: 0 },
        radScale: { value: 0.5 },
        exposureGain: { value: 1 },
        wbTint: { value: new THREE.Vector3(1, 1, 1) },
        isoNoise: { value: 0 },
        noiseSeed: { value: 0 },
        tAO: { value: null as THREE.Texture | null },
        aoStrength: { value: 0 },
      },
    });
  }, []);

  const quadMesh = useMemo(() => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), dofMaterial);
    quadScene.current.add(mesh);
    return mesh;
  }, [dofMaterial]);

  // Sombras de contacto (SSAO) a media resolución.
  const ao = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
    const material = new THREE.ShaderMaterial({
      vertexShader: DOF_VERTEX_SHADER,
      fragmentShader: AO_FRAGMENT_SHADER,
      uniforms: {
        tDepth: { value: null as THREE.Texture | null },
        cameraProjection: { value: new THREE.Matrix4() },
        cameraInverseProjection: { value: new THREE.Matrix4() },
        resolution: { value: new THREE.Vector2(1, 1) },
        radius: { value: AO_RADIUS_M },
      },
    });
    const aoScene = new THREE.Scene();
    aoScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
    return { target, material, scene: aoScene };
  }, []);

  // Fotómetro: el recuadro reducido a una grilla de luminancia que se lee de la GPU.
  const meter = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(METER_GRID_WIDTH, METER_GRID_HEIGHT, {
      type: THREE.FloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: false,
    });
    const material = new THREE.ShaderMaterial({
      vertexShader: DOF_VERTEX_SHADER,
      fragmentShader: METER_DOWNSAMPLE_FRAGMENT_SHADER,
      uniforms: {
        tColor: { value: null as THREE.Texture | null },
        cropMin: { value: new THREE.Vector2(0, 0) },
        cropSize: { value: new THREE.Vector2(1, 1) },
        gridSize: { value: new THREE.Vector2(METER_GRID_WIDTH, METER_GRID_HEIGHT) },
      },
    });
    const meterScene = new THREE.Scene();
    meterScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
    return {
      target,
      material,
      scene: meterScene,
      pixels: new Float32Array(METER_GRID_WIDTH * METER_GRID_HEIGHT * 4),
      luminance: new Float32Array(METER_GRID_WIDTH * METER_GRID_HEIGHT),
      lastMs: 0,
      readings: null as MeterReadings | null,
      failed: false,
    };
  }, []);

  const renderFrame: SimulatorFrameRenderer = useMemo(
    () => (renderer, sceneRef, cameraRef) => {
      const exposureGain = resolveActiveExposureGain();
      const toneExposure = clampRendererExposure(exposureGain * SCENE_RENDER_CALIBRATION);
      const sceneId = simulatorRuntime.sceneId;

      if (usesPhotographicPipeline(sceneId)) {
        applyToneMappingToRenderer(renderer, sceneId, toneExposure);
      } else {
        renderer.toneMapping = THREE.LinearToneMapping;
        renderer.toneMappingExposure = toneExposure;
      }
      if (!simulatorRuntime.captureActive) {
        simulatorRuntime.appliedToneMappingExposure = toneExposure;
      }

      const derived = simulatorRuntime.derived;
      const aperture = derived?.effectiveSettings.aperture ?? 2.8;
      const focalLength = simulatorRuntime.focalLengthMm;
      const focusDistance = simulatorRuntime.focusDistanceM;

      const applyWb = shouldApplyWhiteBalanceToRender(
        simulatorRuntime.viewfinderMode,
        simulatorRuntime.captureActive,
      );
      const wb = derived?.wbTint ?? { r: 1, g: 1, b: 1 };
      dofMaterial.uniforms.wbTint.value.set(
        applyWb ? wb.r : 1,
        applyWb ? wb.g : 1,
        applyWb ? wb.b : 1,
      );

      // El visor óptico no tiene sensor: sólo LIVE VIEW y la foto muestran ruido.
      const iso = derived?.effectiveSettings.iso ?? 100;
      dofMaterial.uniforms.isoNoise.value = applyWb ? isoNoiseFactor(iso) : 0;
      // Durante la toma el patrón queda fijo: promediar cuadros no debe limpiar el ruido.
      if (!simulatorRuntime.captureActive) {
        dofMaterial.uniforms.noiseSeed.value = (dofMaterial.uniforms.noiseSeed.value + 1) % 997;
      }

      const persp = cameraRef as THREE.PerspectiveCamera;
      renderer.setRenderTarget(fbo);
      renderer.clear();
      renderer.render(sceneRef, cameraRef);

      invProj.current.copy(persp.projectionMatrix).invert();

      const quality = simulatorRuntime.quality;
      if (quality.ao) {
        const w = Math.max(1, Math.floor(fbo.width / 2));
        const hgt = Math.max(1, Math.floor(fbo.height / 2));
        if (ao.target.width !== w || ao.target.height !== hgt) ao.target.setSize(w, hgt);
        ao.material.uniforms.tDepth.value = fbo.depthTexture;
        ao.material.uniforms.cameraProjection.value.copy(persp.projectionMatrix);
        ao.material.uniforms.cameraInverseProjection.value.copy(invProj.current);
        ao.material.uniforms.resolution.value.set(w, hgt);
        renderer.setRenderTarget(ao.target);
        renderer.render(ao.scene, orthoCam.current);
      }
      dofMaterial.uniforms.tAO.value = ao.target.texture;
      dofMaterial.uniforms.aoStrength.value = quality.ao ? AO_STRENGTH : 0;

      const now = performance.now();
      if (!simulatorRuntime.captureActive && !meter.failed && now - meter.lastMs >= METER_INTERVAL_MS) {
        const dt = meter.lastMs ? (now - meter.lastMs) / 1000 : 0;
        meter.lastMs = now;
        const insets = computeViewfinderInsets(size.width, size.height);
        meter.material.uniforms.tColor.value = fbo.texture;
        meter.material.uniforms.cropMin.value.set(insets.x, insets.bottom);
        meter.material.uniforms.cropSize.value.set(1 - 2 * insets.x, 1 - insets.top - insets.bottom);
        renderer.setRenderTarget(meter.target);
        renderer.render(meter.scene, orthoCam.current);
        try {
          renderer.readRenderTargetPixels(
            meter.target,
            0,
            0,
            METER_GRID_WIDTH,
            METER_GRID_HEIGHT,
            meter.pixels,
          );
          // readPixels arranca abajo; la grilla del fotómetro va de arriba hacia abajo.
          for (let y = 0; y < METER_GRID_HEIGHT; y += 1) {
            const srcRow = (METER_GRID_HEIGHT - 1 - y) * METER_GRID_WIDTH;
            for (let x = 0; x < METER_GRID_WIDTH; x += 1) {
              meter.luminance[y * METER_GRID_WIDTH + x] = meter.pixels[(srcRow + x) * 4];
            }
          }
          meter.readings = smoothReadings(
            meter.readings,
            readAllModes({
              width: METER_GRID_WIDTH,
              height: METER_GRID_HEIGHT,
              luminance: meter.luminance,
            }),
            dt,
          );
          simulatorRuntime.meterReadings = meter.readings;
        } catch {
          // Sin lectura de texturas float no hay fotómetro de imagen: queda la luz absoluta.
          meter.failed = true;
        }
      }

      const imageHeightPx = size.height * renderer.getPixelRatio();
      const sensorHeightMm = canvasSensorHeightMm(size.width, size.height);
      const maxBlurPx = calculateSceneMaxBlurPx({
        focusDistanceM: focusDistance,
        focalLengthMm: focalLength,
        aperture,
        imageHeightPx,
        sensorHeightMm,
      });

      dofMaterial.uniforms.tColor.value = fbo.texture;
      dofMaterial.uniforms.tDepth.value = fbo.depthTexture;
      dofMaterial.uniforms.focusDistance.value = focusDistance;
      dofMaterial.uniforms.aperture.value = aperture;
      dofMaterial.uniforms.focalLength.value = focalLength;
      dofMaterial.uniforms.sensorHeightMm.value = sensorHeightMm;
      dofMaterial.uniforms.cameraInverseProjection.value = invProj.current;
      dofMaterial.uniforms.resolution.value.set(size.width * renderer.getPixelRatio(), imageHeightPx);
      dofMaterial.uniforms.maxBlurPx.value = maxBlurPx;
      dofMaterial.uniforms.radScale.value = dofRadiusScale(maxBlurPx, simulatorRuntime.quality.dofSteps);
      dofMaterial.uniforms.exposureGain.value = exposureGain;
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(quadScene.current, orthoCam.current);
    },
    [dofMaterial, fbo, meter, ao, size.width, size.height],
  );

  useEffect(() => {
    registerSimulatorFrameRenderer(renderFrame);
    return () => registerSimulatorFrameRenderer(null);
  }, [renderFrame]);

  useFrame(() => {
    renderFrame(gl, scene, camera);
  }, 1);

  useEffect(() => {
    return () => {
      quadMesh.geometry.dispose();
      dofMaterial.dispose();
      meter.target.dispose();
      meter.material.dispose();
      ao.target.dispose();
      ao.material.dispose();
    };
  }, [quadMesh, dofMaterial, meter, ao]);

  return null;
}
