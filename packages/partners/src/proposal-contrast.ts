/**
 * Decide qué placa poner detrás del logo de un anunciante.
 *
 * Los logos suelen venir diseñados para un solo fondo: uno blanco sobre
 * transparente desaparece en una superficie clara. La placa uniforme resuelve
 * eso y es el patrón habitual de los muros de logos.
 */

import { PartnersDomainError } from "./types";

export type LogoLuminanceInput = {
  /** Luminancia media de los píxeles visibles, de 0 (negro) a 1 (blanco). */
  meanLuminance: number;
  /** Si el archivo tiene canal alfa. Sin él, el logo trae su propio fondo. */
  hasAlpha: boolean;
};

export type PlateKind = "LIGHT" | "DARK" | "NONE";

export type PlateTreatment = {
  plate: PlateKind;
  /** Motivo legible, para mostrar en la interfaz. */
  reason: string;
};

/** Por encima de esto el logo se considera claro y necesita fondo oscuro. */
const LIGHT_LOGO_THRESHOLD = 0.62;

export function resolvePlateTreatment(
  input: LogoLuminanceInput,
): PlateTreatment {
  const { meanLuminance, hasAlpha } = input;

  if (!Number.isFinite(meanLuminance) || meanLuminance < 0 || meanLuminance > 1) {
    throw new PartnersDomainError(
      "VALIDATION",
      "La luminancia debe estar entre 0 y 1.",
    );
  }

  if (!hasAlpha) {
    return {
      plate: "NONE",
      reason: "El logo trae su propio fondo, así que se usa tal cual.",
    };
  }

  if (meanLuminance > LIGHT_LOGO_THRESHOLD) {
    return {
      plate: "DARK",
      reason: "El logo es claro y se perdería sobre fondo blanco.",
    };
  }

  return {
    plate: "LIGHT",
    reason: "El logo es oscuro y se lee bien sobre fondo claro.",
  };
}
