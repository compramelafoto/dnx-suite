"use server";

import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import type { ModoDeEnsayo } from "./application/dry-run-steps";
import { correrEnsayoEnSeco, type ResultadoEnsayoEnSeco } from "./application/run-dry-rehearsal";
import { descartarEdicionDeEnsayo } from "./application/discard-edition";
import { correrChequeoDeEdicion } from "./application/run-edition-check";
import {
  correrEnsayoCompleto,
  type ResultadoEnsayoCompleto,
} from "./application/run-full-rehearsal";
import { PALABRA_DE_CONFIRMACION, confirmacionValida } from "./domain/confirmacion";
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

/**
 * Ensayo completo: crea una copia descartable, escribe de verdad sobre ella y
 * la deja en pie para poder recorrerla.
 *
 * Pide escribir una palabra fija antes de arrancar. Antes pedía el nombre
 * exacto de la edición, pero los nombres reales traen espacios dobles y
 * símbolos que no se ven en pantalla: nadie lograba escribirlos.
 *
 * La edición real nunca se toca: todo lo que se escribe cuelga de la copia.
 */
export async function ensayarCompletoAction(
  editionId: string,
  confirmacion: string,
  dejarEnPie = false,
): Promise<ResultadoEnsayoCompleto> {
  const user = await requireClickatonAdmin({
    returnTo: `/admin/ediciones/${editionId}/ensayo`,
  });

  const id = editionId.trim();
  if (!id) return { ok: false, mensaje: "Falta el identificador de la edición." };

  if (!confirmacionValida(confirmacion)) {
    return {
      ok: false,
      mensaje: `Para confirmar, escribí «${PALABRA_DE_CONFIRMACION}» en el casillero.`,
    };
  }

  const edicion = await prisma.clickatonEdition.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!edicion) return { ok: false, mensaje: "No encontramos esa edición." };

  return correrEnsayoCompleto({ editionId: id, operadorUserId: user.id, dejarEnPie });
}

/**
 * Borra una copia de ensayo que quedó en pie.
 *
 * El guardián del borrado se niega a tocar nada que no esté marcado como copia
 * descartable, así que no hay forma de que esto alcance una edición real.
 */
export async function descartarCopiaDeEnsayoAction(
  editionId: string,
  copiaId: string,
): Promise<{ ok: true; borrado: Record<string, number> } | { ok: false; mensaje: string }> {
  await requireClickatonAdmin({ returnTo: `/admin/ediciones/${editionId}/ensayo` });

  const id = copiaId.trim();
  if (!id) return { ok: false, mensaje: "Falta el identificador de la copia." };

  return descartarEdicionDeEnsayo(id);
}
