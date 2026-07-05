/**
 * Perfiles de sensor — Cam Of Duty.
 * Default: Full Frame. APS-C y Micro 4/3 preparados para futuro.
 */

export type SensorFormatId = "FULL_FRAME" | "APS_C" | "MFT";

export interface SensorProfile {
  id: SensorFormatId;
  label: string;
  /** Ancho del sensor en mm. */
  widthMm: number;
  /** Alto del sensor en mm (usado para FOV vertical). */
  heightMm: number;
  /** Círculo de confusión aceptable en mm. */
  circleOfConfusionMm: number;
  /** Factor de crop respecto a Full Frame (36×24 mm). */
  cropFactor: number;
}

export const SENSOR_PROFILES: Record<SensorFormatId, SensorProfile> = {
  FULL_FRAME: {
    id: "FULL_FRAME",
    label: "Full Frame",
    widthMm: 36,
    heightMm: 24,
    circleOfConfusionMm: 0.03,
    cropFactor: 1,
  },
  APS_C: {
    id: "APS_C",
    label: "APS-C",
    widthMm: 23.5,
    heightMm: 15.6,
    circleOfConfusionMm: 0.02,
    cropFactor: 1.5,
  },
  MFT: {
    id: "MFT",
    label: "Micro 4/3",
    widthMm: 17.3,
    heightMm: 13,
    circleOfConfusionMm: 0.015,
    cropFactor: 2,
  },
};

/** Sensor activo del simulador (Full Frame por defecto). */
export const DEFAULT_SENSOR_FORMAT: SensorFormatId = "FULL_FRAME";

export function getSensorProfile(format: SensorFormatId = DEFAULT_SENSOR_FORMAT): SensorProfile {
  return SENSOR_PROFILES[format];
}

export function getActiveSensor(): SensorProfile {
  return getSensorProfile(DEFAULT_SENSOR_FORMAT);
}
