import type { Cuestionario } from "../tipos";
import { CUESTIONARIO_CLUB_POR_SUSCRIPCION } from "./club-por-suscripcion";
import { CUESTIONARIO_PRODUCTORA_DOCENTE } from "./productora-docente";
import { CUESTIONARIO_REGISTRO_DOCENTE } from "./registro-docente";

/**
 * Los cuestionarios disponibles, por clave. La fila de `FotofficeAltaCliente` guarda la clave:
 * para un cliente nuevo de otro rubro se suma acá un cuestionario y se crea la fila con su clave.
 */
const CUESTIONARIOS: Record<string, Cuestionario> = {
  [CUESTIONARIO_PRODUCTORA_DOCENTE.clave]: CUESTIONARIO_PRODUCTORA_DOCENTE,
  [CUESTIONARIO_CLUB_POR_SUSCRIPCION.clave]: CUESTIONARIO_CLUB_POR_SUSCRIPCION,
  [CUESTIONARIO_REGISTRO_DOCENTE.clave]: CUESTIONARIO_REGISTRO_DOCENTE,
};

export function cuestionarioPorClave(clave: string): Cuestionario | null {
  return CUESTIONARIOS[clave] ?? null;
}

export function clavesDeCuestionarios(): string[] {
  return Object.keys(CUESTIONARIOS);
}
