"use client";

import {
  DOF_FRAGMENT_SHADER,
  DOF_VERTEX_SHADER,
} from "@/lib/simulator/dof-shaders";
import {
  clampRendererExposure,
  resolveActiveExposureGain,
  SCENE_RENDER_CALIBRATION,
  shouldApplyWhiteBalanceToRender,
} from "@/lib/simulator/camera-exposure";
import { applyToneMappingToRenderer, usesPhotographicPipeline } from "@/lib/simulator/render";
import {
  DOF_BACK_FALLOFF,
  DOF_BLUR_STRENGTH,
  DOF_FRONT_FALLOFF,
  DOF_SKIP_APERTURE,
  DOF_TRANSITION_SOFTNESS,
  calculateDepthOfFieldLimits,
} from "@/lib/simulator/depth-of-field";
import { getActiveSensor } from "@/lib/simulator/sensor";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import {
  registerSimulatorFrameRenderer,
  type SimulatorFrameRenderer,
} from "@/lib/simulator/simulator-frame-renderer";
import { useFBO } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const MAX_BLUR_PX = 16;

/**
 * Renderiza la escena con DOF por distancia (plano de enfoque).
 * CoC fotográfico + mezcla gradual nítido/desenfocado.
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
        cameraNear: { value: 0.15 },
        cameraFar: { value: 90 },
        cameraInverseProjection: { value: new THREE.Matrix4() },
        resolution: { value: new THREE.Vector2(1, 1) },
        maxBlurPx: { value: MAX_BLUR_PX },
        nearLimit: { value: 4 },
        farLimit: { value: 12 },
        farLimitFinite: { value: 1 },
        cocMm: { value: getActiveSensor().circleOfConfusionMm },
        blurStrength: { value: DOF_BLUR_STRENGTH },
        transitionSoftness: { value: DOF_TRANSITION_SOFTNESS },
        frontFalloff: { value: DOF_FRONT_FALLOFF },
        backFalloff: { value: DOF_BACK_FALLOFF },
        exposureGain: { value: 1 },
        wbTint: { value: new THREE.Vector3(1, 1, 1) },
      },
    });
  }, []);

  const quadMesh = useMemo(() => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), dofMaterial);
    quadScene.current.add(mesh);
    return mesh;
  }, [dofMaterial]);

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

      const persp = cameraRef as THREE.PerspectiveCamera;
      renderer.setRenderTarget(fbo);
      renderer.clear();
      renderer.render(sceneRef, cameraRef);

      invProj.current.copy(persp.projectionMatrix).invert();

      const skipDof = aperture >= DOF_SKIP_APERTURE;
      const limits = skipDof
        ? { nearLimitM: 0, farLimitM: focusDistance * 8 }
        : calculateDepthOfFieldLimits({
            focusDistanceM: focusDistance,
            focalLengthMm: focalLength,
            aperture,
          });

      const farFinite = Number.isFinite(limits.farLimitM);

      dofMaterial.uniforms.tColor.value = fbo.texture;
      dofMaterial.uniforms.tDepth.value = fbo.depthTexture;
      dofMaterial.uniforms.focusDistance.value = focusDistance;
      dofMaterial.uniforms.aperture.value = skipDof ? DOF_SKIP_APERTURE : aperture;
      dofMaterial.uniforms.focalLength.value = focalLength;
      dofMaterial.uniforms.cameraNear.value = persp.near;
      dofMaterial.uniforms.cameraFar.value = persp.far;
      dofMaterial.uniforms.cameraInverseProjection.value = invProj.current;
      dofMaterial.uniforms.resolution.value.set(
        size.width * renderer.getPixelRatio(),
        size.height * renderer.getPixelRatio(),
      );
      dofMaterial.uniforms.maxBlurPx.value = MAX_BLUR_PX;
      dofMaterial.uniforms.nearLimit.value = limits.nearLimitM;
      dofMaterial.uniforms.farLimit.value = farFinite ? limits.farLimitM : focusDistance * 8;
      dofMaterial.uniforms.farLimitFinite.value = farFinite ? 1 : 0;
      dofMaterial.uniforms.cocMm.value = getActiveSensor().circleOfConfusionMm;
      dofMaterial.uniforms.blurStrength.value = DOF_BLUR_STRENGTH;
      dofMaterial.uniforms.transitionSoftness.value = DOF_TRANSITION_SOFTNESS;
      dofMaterial.uniforms.frontFalloff.value = DOF_FRONT_FALLOFF;
      dofMaterial.uniforms.backFalloff.value = DOF_BACK_FALLOFF;
      dofMaterial.uniforms.exposureGain.value = exposureGain;

      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(quadScene.current, orthoCam.current);
    },
    [dofMaterial, fbo, size.width, size.height],
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
    };
  }, [quadMesh, dofMaterial]);

  return null;
}
