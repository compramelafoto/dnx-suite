/**
 * Cam Of Duty — Estudio Fotográfico.
 *
 * Coordenadas del set (metros, Y hacia arriba):
 * - El sujeto está en el origen mirando hacia +Z (hacia la cámara por defecto).
 * - El fondo está detrás del sujeto, en Z negativo.
 * - Acimut 0° = delante del sujeto; positivo = a la derecha de la cámara (+X).
 */

export type ModifierId =
  | "bare"
  | "snoot"
  | "grid"
  | "beauty-dish"
  | "umbrella-white"
  | "softbox-small"
  | "softbox-large"
  | "octabox"
  | "stripbox"
  | "ring"
  | "fresnel"
  | "led-panel"
  | "reflector-white"
  | "reflector-silver"
  | "reflector-gold";

/** Flash (no depende del obturador), continua (sí depende) o rebote pasivo. */
export type LightNature = "flash" | "continuous" | "reflector";

/** Hacia dónde apunta la luz. */
export type LightAim = "subject" | "hair" | "background";

export interface StudioLight {
  id: string;
  name: string;
  on: boolean;
  solo: boolean;
  modifier: ModifierId;
  /** Posición del cabezal en metros. */
  x: number;
  y: number;
  z: number;
  aim: LightAim;
  /** Flash: pasos bajo plena potencia (0 = 1/1, 7 = 1/128). Continua: igual, sobre su máximo. */
  powerStops: number;
  /** Gel: id del catálogo de geles. */
  gel: string;
  /** Sólo luces continuas LED: temperatura de color. */
  kelvin: number;
}

export type BackdropId = "white" | "grey" | "black" | "blue" | "green" | "warm";

import type { SubjectId } from "./figures";
import type { PoseId, PoseParams } from "./poses";

export type { SubjectId };

export interface StudioCamera {
  x: number;
  y: number;
  z: number;
  focalMm: number;
  /** Número f. */
  aperture: number;
  /** Segundos. */
  shutter: number;
  iso: number;
  /** Balance de blancos de la cámara (K). */
  whiteBalance: number;
  /** Altura a la que apunta la cámara (m): cara, medio cuerpo o cuerpo entero. */
  aimY: number;
  /**
   * Mirada libre (radianes) cuando el fotógrafo camina en primera persona.
   * null = la cámara apunta al sujeto a la altura aimY.
   */
  look: { yaw: number; pitch: number } | null;
}

export interface StudioState {
  lights: StudioLight[];
  selectedId: string | null;
  camera: StudioCamera;
  subject: SubjectId;
  /** Giro del sujeto en grados (positivo = hacia la derecha de cámara). */
  subjectYaw: number;
  /** Pose del modelo de cuerpo entero ("custom" si se movió alguna articulación). */
  pose: PoseId | "custom";
  poseParams: PoseParams;
  /** Movimiento del modelo de cuerpo entero. */
  motion: {
    /** Respira y se balancea mientras mantiene la pose. */
    natural: boolean;
    /** Animación completa en curso (id de ANIMATIONS) o null. */
    clip: string | null;
  };
  backdrop: BackdropId;
  /** Luz de la sala (lux). 0 = estudio a oscuras. */
  roomLux: number;
}
