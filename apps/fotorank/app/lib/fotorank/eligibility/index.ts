export * from "./types";
export * from "./argra";

import type { ContestRulesConfiguration } from "../rules-config/types";

/** Participación abierta: residencia del participante nunca bloquea. */
export function assertOpenParticipation(config?: ContestRulesConfiguration | null): {
  residencyRequired: false;
  reasonCode: "RESIDENCY_NOT_REQUIRED";
  publicMessage: string;
} {
  void config;
  return {
    residencyRequired: false,
    reasonCode: "RESIDENCY_NOT_REQUIRED",
    publicMessage:
      "La participación es abierta. No es necesario residir en la Provincia de Santa Fe. La fotografía presentada deberá haber sido realizada dentro del territorio de la Provincia de Santa Fe y durante el período oficial establecido para el concurso.",
  };
}
