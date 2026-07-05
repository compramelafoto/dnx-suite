/**
 * Estado del peatón fotográfico — Ciudad Fotográfica.
 */

export type PhotographicPedestrianSpeedPreset = "slow" | "normal" | "fast";

const SPEED_MS: Record<PhotographicPedestrianSpeedPreset, number> = {
  slow: 1.0,
  normal: 1.65,
  fast: 2.5,
};

export interface PhotographicPedestrianRuntime {
  enabled: boolean;
  speedPreset: PhotographicPedestrianSpeedPreset;
  getSpeedMs: () => number;
}

export const photographicPedestrianRuntime: PhotographicPedestrianRuntime = {
  enabled: true,
  speedPreset: "normal",
  getSpeedMs() {
    return SPEED_MS[this.speedPreset];
  },
};

export function setPhotographicPedestrianEnabled(enabled: boolean): void {
  photographicPedestrianRuntime.enabled = enabled;
}

export function setPhotographicPedestrianSpeedPreset(
  preset: PhotographicPedestrianSpeedPreset,
): void {
  photographicPedestrianRuntime.speedPreset = preset;
}
