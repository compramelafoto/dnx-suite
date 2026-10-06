import "server-only";
import type { TipoSujeto } from "../constantes";
import { adaptadorCaptacion } from "./captacion";
import type { Adaptador } from "./tipos";

export type { Adaptador, NombreDeSujeto, Sujeto } from "./tipos";

/** Sólo Captación está conectada; los demás tipos están reservados. */
const ADAPTADORES: Partial<Record<TipoSujeto, Adaptador>> = { CAPTACION: adaptadorCaptacion };

export function adaptadorDe(tipo: string): Adaptador | null {
  return Object.hasOwn(ADAPTADORES, tipo) ? (ADAPTADORES[tipo as TipoSujeto] ?? null) : null;
}
