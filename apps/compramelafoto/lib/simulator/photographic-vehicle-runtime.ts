/**
 * Estado del vehículo fotográfico — tráfico simple Ciudad Fotográfica.
 */

export type PhotographicVehicleSpeedPreset = "slow" | "medium" | "fast";

const SPEED_MS: Record<PhotographicVehicleSpeedPreset, number> = {
  slow: 3.5,
  medium: 6.5,
  fast: 11,
};

export interface PhotographicVehicleRuntime {
  enabled: boolean;
  speedPreset: PhotographicVehicleSpeedPreset;
  getSpeedMs: () => number;
}

export const photographicVehicleRuntime: PhotographicVehicleRuntime = {
  enabled: true,
  speedPreset: "medium",
  getSpeedMs() {
    return SPEED_MS[this.speedPreset];
  },
};

export function setPhotographicVehicleEnabled(enabled: boolean): void {
  photographicVehicleRuntime.enabled = enabled;
}

export function setPhotographicVehicleSpeedPreset(
  preset: PhotographicVehicleSpeedPreset,
): void {
  photographicVehicleRuntime.speedPreset = preset;
}
