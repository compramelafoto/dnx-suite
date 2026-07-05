/**
 * Cam Of Duty — tipos compartidos del simulador fotográfico.
 *
 * TODO (etapas futuras):
 * - Integrar con React Three Fiber / Three.js para escenas 3D
 * - Modelar cámara fotográfica real con parámetros físicos
 * - Sistema de ejercicios y seguimiento de progreso
 * - Certificaciones y registro de usuario independiente
 */

/** Modo de exposición de la cámara simulada. */
export type ExposureMode = "manual" | "aperture-priority" | "shutter-priority" | "auto";

/** Balance de blancos en kelvin. */
export type WhiteBalanceKelvin = number;

/** Parámetros de exposición de la cámara. */
export interface CameraExposureSettings {
  iso: number;
  aperture: number;
  shutterSpeed: string;
  whiteBalance: WhiteBalanceKelvin;
  mode: ExposureMode;
}

/** Identificador de escena virtual. */
export type SceneId = string;

/** Metadatos básicos de un escenario de entrenamiento. */
export interface SimulatorSceneMeta {
  id: SceneId;
  name: string;
  description: string;
  /** TODO: cargar geometría y luces con Three.js */
  available: boolean;
}

/** Estado global del simulador (placeholder para etapas futuras). */
export interface SimulatorState {
  sceneId: SceneId | null;
  camera: CameraExposureSettings;
  /** TODO: posición y rotación del jugador (navegación FPS) */
  position: [number, number, number];
  rotation: [number, number, number];
}
