/**
 * ETAPA 16B — Guardia de seguridad de producto.
 * "Do NOT activate jury/public vote/results on commercial contest cmslf0ny10005i7nlqe7xqbea"
 * (instrucción explícita de la etapa). Bloquea a nivel de código, no solo por procedimiento,
 * cualquier mutación de estado de jurado/finalistas/voto público sobre ese concurso puntual.
 */
import { JuryError } from "./errors";

/** Concurso comercial productivo excluido de activación de jurado/voto público en esta etapa. */
export const COMMERCIAL_CONTEST_ID_BLOCKED = "cmslf0ny10005i7nlqe7xqbea";

export function assertJuryActivationAllowed(contestId: string): void {
  if (contestId === COMMERCIAL_CONTEST_ID_BLOCKED) {
    throw new JuryError(
      "COMMERCIAL_CONTEST_BLOCKED",
      "Este concurso comercial no puede activar jurado, finalistas ni voto público en esta etapa.",
      403,
    );
  }
}
