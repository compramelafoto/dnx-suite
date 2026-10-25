import { PHOTOGRAPHIC_CITY_SCENE } from "./photographic-city-scene";
import type { PlannedSceneId, SimulatorSceneId, SimulatorSceneMeta } from "./types";

export type { PlannedSceneId, SceneBounds, SceneSpawnPose, SceneType, SimulatorSceneId, SimulatorSceneMeta } from "./types";

export { PHOTOGRAPHIC_CITY_SCENE } from "./photographic-city-scene";

/** Escena por defecto (y por ahora la única): la Calle 3D. */
export const DEFAULT_SCENE_ID: SimulatorSceneId = PHOTOGRAPHIC_CITY_SCENE.id;

export const SCENE_BY_ID: Record<SimulatorSceneId, SimulatorSceneMeta> = {
  "photographic-city": PHOTOGRAPHIC_CITY_SCENE,
};

/** Catálogo futuro (solo UI). */
export const PLANNED_SCENES: readonly { id: PlannedSceneId; label: string }[] = [
  { id: "park", label: "Parque" },
  { id: "plaza", label: "Plaza" },
  { id: "beach", label: "Playa" },
  { id: "mountain", label: "Montaña" },
  { id: "gym", label: "Gimnasio" },
  { id: "church", label: "Iglesia" },
  { id: "event-hall", label: "Salón de eventos" },
  { id: "stadium", label: "Estadio deportivo" },
];

export function getSceneMeta(sceneId: SimulatorSceneId): SimulatorSceneMeta {
  return SCENE_BY_ID[sceneId];
}
