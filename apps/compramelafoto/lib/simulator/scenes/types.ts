/**
 * Tipos del sistema de escenas — Cam Of Duty.
 */

export type SimulatorSceneId = "studio" | "city" | "photographic-city";

export type SceneType = "studio" | "exterior" | "photographic-exterior";

/** Escenas planificadas (futuro). */
export type PlannedSceneId =
  | "park"
  | "plaza"
  | "beach"
  | "mountain"
  | "gym"
  | "church"
  | "event-hall"
  | "stadium";

export interface SceneBounds {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
}

export interface SceneSpawnPose {
  position: readonly [number, number, number];
  lookAt: readonly [number, number, number];
}

export interface SimulatorSceneMeta {
  id: SimulatorSceneId;
  sceneType: SceneType;
  label: string;
  description: string;
  available: boolean;
  /** Escena en desarrollo — visible con aviso en UI. */
  experimental?: boolean;
  bounds: SceneBounds;
  spawn: SceneSpawnPose;
  /** Usa luz solar dinámica (exterior legacy: cielo procedural). */
  usesNaturalLight: boolean;
  /** Pipeline fotográfico: HDRI por hora, ACES, glTF, sin primitivas. */
  usesPhotographicPipeline?: boolean;
}
