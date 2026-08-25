/**
 * Contratos públicos FotoRank HOME welcome (seguros para Client Components).
 */
import type { FotorankContestWelcomePublicPayload } from "./contest-welcome-shared";

export const FOTORANK_HOME_WELCOME_PLACEMENT = "FOTORANK_HOME_WELCOME" as const;

/** Mismo delay que la placa de concurso. */
export const FOTORANK_HOME_WELCOME_APPEAR_DELAY_MS = 1000;

/** Misma forma que la placa de concurso: cambia la superficie, no el contrato. */
export type FotorankHomeWelcomePublicPayload = FotorankContestWelcomePublicPayload;
