"use client";

import {
  COD_FOCUS_REQUEST_EVENT,
  COD_FOCUS_TARGET_EVENT,
  type CodFocusRequestDetail,
  type CodFocusTargetDetail,
} from "@/lib/simulator/focus-events";
import {
  focusSearchDelayMs,
  pickBestFocusHit,
  roundFocusDistanceM,
  sampleNdcForActiveArea,
  scoreRaycastHit,
  type SimulatedFocusHit,
} from "@/lib/simulator/focus-math";
import {
  findMovingSubject,
  isPhotographicPedestrianId,
  PHOTOGRAPHIC_PEDESTRIAN_SUBJECT_ID,
} from "@/lib/simulator/moving-subject-types";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

const _ndc = new THREE.Vector2();
const _world = new THREE.Vector3();

/**
 * Adquisición AF por raycast + contraste simulado (delay pedagógico).
 */
export default function FocusRaycaster() {
  const { camera, scene } = useThree();
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const raycaster = new THREE.Raycaster();

    const acquireAtNdc = (ndcSamples: [number, number][]): SimulatedFocusHit[] => {
      const candidates: SimulatedFocusHit[] = [];

      for (const [nx, ny] of ndcSamples) {
        _ndc.set(nx, ny);
        raycaster.setFromCamera(_ndc, camera);
        const hits = raycaster.intersectObjects(scene.children, true);
        const hit = hits.find((h) => h.object instanceof THREE.Mesh && h.distance > 0.05);
        if (!hit) continue;

        const distanceM = camera.position.distanceTo(hit.point);
        const scored = scoreRaycastHit(hit.object, distanceM);
        candidates.push({
          distanceM: roundFocusDistanceM(distanceM),
          targetLabel: scored.label,
          worldPoint: [hit.point.x, hit.point.y, hit.point.z],
          focusConfidence: scored.confidence,
          focusedObjectId: scored.objectId,
        });
      }

      return candidates;
    };

    const onFocusRequest = (event: Event) => {
      const detail = (event as CustomEvent<CodFocusRequestDetail>).detail;

      if (pendingRef.current) {
        clearTimeout(pendingRef.current);
        pendingRef.current = null;
      }

      const areaMode = detail.focusAreaMode ?? simulatorRuntime.focusAreaMode;
      const areaIndex = detail.activeFocusPointIndex ?? simulatorRuntime.activeFocusPointIndex;

      let ndcSamples: [number, number][];
      if (detail.ndc) {
        ndcSamples = [detail.ndc];
      } else {
        ndcSamples = sampleNdcForActiveArea(areaMode, areaIndex);
      }

      const delayMs = focusSearchDelayMs();

      pendingRef.current = setTimeout(() => {
        pendingRef.current = null;
        const candidates = acquireAtNdc(ndcSamples);
        const best = pickBestFocusHit(candidates);

        let distanceM: number;
        let targetLabel: string;
        let worldPoint: [number, number, number] | null;
        let focusConfidence: number;
        let focusedObjectId: string | null;

        if (best) {
          distanceM = best.distanceM;
          targetLabel = best.targetLabel;
          worldPoint = best.worldPoint;
          focusConfidence = best.focusConfidence;
          focusedObjectId = best.focusedObjectId;
        } else {
          raycaster.setFromCamera(_ndc.set(ndcSamples[0][0], ndcSamples[0][1]), camera);
          raycaster.ray.at(40, _world);
          distanceM = roundFocusDistanceM(camera.position.distanceTo(_world));
          targetLabel = "Infinito";
          worldPoint = [_world.x, _world.y, _world.z];
          focusConfidence = 0.22;
          focusedObjectId = null;
        }

        if (!best && areaMode === "WIDE") {
          const subj =
            simulatorRuntime.movingSubjects.find(
              (s) => s.visible && isPhotographicPedestrianId(s.id),
            ) ??
            findMovingSubject(
              simulatorRuntime.movingSubjects,
              PHOTOGRAPHIC_PEDESTRIAN_SUBJECT_ID,
            ) ??
            simulatorRuntime.movingSubject;
          if (subj?.visible) {
            const d = roundFocusDistanceM(
              Math.hypot(
                subj.position[0] - camera.position.x,
                subj.position[1] - camera.position.y,
                subj.position[2] - camera.position.z,
              ),
            );
            distanceM = d;
            focusConfidence = 0.52;
            focusedObjectId = subj.id;
            targetLabel = isPhotographicPedestrianId(subj.id)
              ? "Peatón"
              : subj.subjectKind === "human"
                ? "Persona"
                : "Sujeto";
            worldPoint = subj.position;
          }
        }

        window.dispatchEvent(
          new CustomEvent(COD_FOCUS_TARGET_EVENT, {
            detail: {
              distanceM,
              targetLabel,
              worldPoint,
              focusConfidence,
              focusedObjectId,
            },
          }),
        );
      }, delayMs);
    };

    window.addEventListener(COD_FOCUS_REQUEST_EVENT, onFocusRequest);
    return () => {
      window.removeEventListener(COD_FOCUS_REQUEST_EVENT, onFocusRequest);
      if (pendingRef.current) clearTimeout(pendingRef.current);
    };
  }, [camera, scene]);

  return null;
}
