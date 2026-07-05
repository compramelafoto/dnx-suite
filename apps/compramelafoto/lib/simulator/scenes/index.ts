import { CITY_SCENE } from "./city-scene";
import { PHOTOGRAPHIC_CITY_SCENE } from "./photographic-city-scene";
import { STUDIO_SCENE } from "./studio-scene";
import type { PlannedSceneId, SimulatorSceneId, SimulatorSceneMeta } from "./types";

export type { PlannedSceneId, SceneBounds, SceneSpawnPose, SceneType, SimulatorSceneId, SimulatorSceneMeta } from "./types";

export { STUDIO_SCENE } from "./studio-scene";
export { CITY_SCENE, CITY_STREET } from "./city-scene";
export { PHOTOGRAPHIC_CITY_SCENE } from "./photographic-city-scene";

export const AVAILABLE_SCENES: readonly SimulatorSceneMeta[] = [
  STUDIO_SCENE,
  CITY_SCENE,
  PHOTOGRAPHIC_CITY_SCENE,
];

export const SCENE_BY_ID: Record<SimulatorSceneId, SimulatorSceneMeta> = {
  studio: STUDIO_SCENE,
  city: CITY_SCENE,
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

export function isExteriorScene(sceneId: SimulatorSceneId): boolean {
  return SCENE_BY_ID[sceneId].usesNaturalLight;
}

export function isPhotographicScene(sceneId: SimulatorSceneId): boolean {
  return SCENE_BY_ID[sceneId].usesPhotographicPipeline === true;
}

export function isLegacyCityPrototype(sceneId: SimulatorSceneId): boolean {
  return sceneId === "city";
}
