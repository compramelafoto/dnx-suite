"use server";

import { requireClickatonAdmin } from "@/lib/admin/auth";
import type { ModoDeEnsayo } from "./application/dry-run-steps";
import { correrEnsayoEnSeco, type ResultadoEnsayoEnSeco } from "./application/run-dry-rehearsal";
import { correrChequeoDeEdicion } from "./application/run-edition-check";
import type { Hallazgo } from "./domain/types";

export type RespuestaChequeo =
  | { ok: true; hallazgos: Hallazgo[]; revisadoEl: string }
  | { ok: false; mensaje: string };

/**
 * Revisa una edición y devuelve los hallazgos. No escribe nada.
 *
 * Se puede apretar en cualquier momento, incluso con la maratón en curso.
 */
export async function chequearEdicionAction(editionId: string): Promise<RespuestaChequeo> {
  await requireClickatonAdmin({ returnTo: `/admin/ediciones/${editionId}/ensayo` });

  const id = editionId.trim();
  if (!id) return { ok: false, mensaje: "Falta el identificador de la edición." };

  const resultado = await correrChequeoDeEdicion(id);
  if (!resultado.ok) return { ok: false, mensaje: resultado.mensaje };

  return {
    ok: true,
    hallazgos: resultado.hallazgos,
    revisadoEl: new Date().toISOString(),
  };
}

/**
 * Corre el ensayo del recorrido de un participante, en seco.
 *
 * `momentoIso` sólo se usa en modo INSTANTE; en modo RECORRIDO cada paso se
 * evalúa en el momento en que de verdad ocurriría. El reloj vive acá adentro y
 * no se propaga a ningún otro pedido.
 */
export async function ensayarEnSecoAction(
  editionId: string,
  momentoIso: string | null,
  modo: ModoDeEnsayo,
): Promise<ResultadoEnsayoEnSeco> {
  await requireClickatonAdmin({ returnTo: `/admin/ediciones/${editionId}/ensayo` });

  const id = editionId.trim();
  if (!id) return { ok: false, mensaje: "Falta el identificador de la edición." };

  let momento: Date | null = null;
  if (modo === "INSTANTE") {
    if (!momentoIso) {
      return { ok: false, mensaje: "Elegí la fecha y la hora que querés simular." };
    }
    const fecha = new Date(momentoIso);
    if (Number.isNaN(fecha.getTime())) {
      return { ok: false, mensaje: "Esa fecha y hora no se entienden. Revisalas." };
    }
    momento = fecha;
  }

  return correrEnsayoEnSeco({ editionId: id, momento, modo });
}
