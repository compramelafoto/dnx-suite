import "server-only";

import { systemClock, type EditionClock } from "@/lib/timeline/clock";
import { revisarEdicion } from "../domain/checks";
import type { FotoDeEdicion, Hallazgo } from "../domain/types";
import { cargarFotoDeEdicion } from "./load-edition-snapshot";

export type ResultadoChequeo =
  | { ok: true; foto: FotoDeEdicion; hallazgos: Hallazgo[] }
  | { ok: false; mensaje: string };

/** Lee la edición y le aplica todos los controles. No escribe nada. */
export async function correrChequeoDeEdicion(
  editionId: string,
  clock: EditionClock = systemClock(),
): Promise<ResultadoChequeo> {
  try {
    const foto = await cargarFotoDeEdicion(editionId);
    if (!foto) {
      return { ok: false, mensaje: "No encontramos esa edición." };
    }
    return { ok: true, foto, hallazgos: revisarEdicion(foto, clock) };
  } catch {
    return {
      ok: false,
      mensaje: "No pudimos leer la edición. Revisá la conexión e intentá de nuevo.",
    };
  }
}
