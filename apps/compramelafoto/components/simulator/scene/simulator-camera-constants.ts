import type { SimulatorSceneId } from "@/lib/simulator/scenes";
import { getSceneMeta } from "@/lib/simulator/scenes";

/** Altura de cámara a nivel de ojos humano (metros). */
export const EYE_HEIGHT = 1.65;

/** Clase de la capa transparente que recibe clicks para Pointer Lock. */
export const COD_NAV_SURFACE_CLASS = "cod-sim__nav-surface";

/** Selector usado por PointerLockControls (drei). */
export const COD_NAV_SURFACE_SELECTOR = `.${COD_NAV_SURFACE_CLASS}`;

export function getSimulatorSpawnPose(sceneId: SimulatorSceneId = "studio") {
  return getSceneMeta(sceneId).spawn;
}
