"use server";

import { requireClickatonAdmin } from "@/lib/admin/auth";
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
