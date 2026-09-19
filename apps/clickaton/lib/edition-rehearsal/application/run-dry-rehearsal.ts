import "server-only";

import { fixedClock, systemClock, type EditionClock } from "@/lib/timeline/clock";
import { calcularAtajosDeReloj } from "../domain/timeline-presets";
import type { ResultadoEnsayo, ResultadoPaso } from "../domain/types";
import { correrPasosEnSeco, type ModoDeEnsayo } from "./dry-run-steps";
import { cargarFotoDeEdicion } from "./load-edition-snapshot";

/**
 * Atajo tal como cruza al navegador: la fecha viaja en texto ISO, no como
 * objeto, para que no dependa de cómo serialice el borde cliente/servidor.
 */
export type AtajoSerializado = {
  id: string;
  etiqueta: string;
  momentoIso: string | null;
  porQue: string;
};

export type ResultadoEnsayoEnSeco =
  | { ok: true; resultado: ResultadoEnsayo; atajos: AtajoSerializado[] }
  | { ok: false; mensaje: string };

function serializarAtajos(
  atajos: ReturnType<typeof calcularAtajosDeReloj>,
): AtajoSerializado[] {
  return atajos.map((a) => ({
    id: a.id,
    etiqueta: a.etiqueta,
    momentoIso: a.momento ? a.momento.toISOString() : null,
    porQue: a.porQue,
  }));
}

function veredictoDe(pasos: ResultadoPaso[], modo: ModoDeEnsayo): string {
  const fallidos = pasos.filter((p) => p.estado === "FALLO");
  if (fallidos.length === 0) {
    return modo === "RECORRIDO"
      ? "El recorrido completo funciona: un participante puede inscribirse, acreditarse, ver las consignas y subir su foto."
      : "A esa hora no hay nada roto.";
  }
  const primero = fallidos[0]!;
  return fallidos.length === 1
    ? `El recorrido se corta en el paso ${primero.numero}: ${primero.nombre.toLowerCase()}.`
    : `El recorrido tiene ${fallidos.length} problemas; el primero está en el paso ${primero.numero}: ${primero.nombre.toLowerCase()}.`;
}

/**
 * Corre el ensayo en seco sobre una edición real.
 *
 * Lee la configuración de la base pero no escribe nada: se puede usar con la
 * maratón en curso.
 */
export async function correrEnsayoEnSeco(input: {
  editionId: string;
  momento?: Date | null;
  modo?: ModoDeEnsayo;
}): Promise<ResultadoEnsayoEnSeco> {
  const modo = input.modo ?? "RECORRIDO";
  try {
    const foto = await cargarFotoDeEdicion(input.editionId);
    if (!foto) return { ok: false, mensaje: "No encontramos esa edición." };

    const clock: EditionClock = input.momento ? fixedClock(input.momento) : systemClock();
    const pasos = await correrPasosEnSeco({ foto, clock, modo });

    return {
      ok: true,
      resultado: {
        momentoSimulado: clock.now().toISOString(),
        pasos,
        veredicto: veredictoDe(pasos, modo),
      },
      atajos: serializarAtajos(calcularAtajosDeReloj(foto, clock)),
    };
  } catch {
    return {
      ok: false,
      mensaje: "No pudimos correr el ensayo. Revisá la conexión e intentá de nuevo.",
    };
  }
}

/** Atajos del reloj de una edición, para poblar la pantalla antes de ensayar. */
export async function cargarAtajosDeEdicion(
  editionId: string,
): Promise<{ ok: true; atajos: AtajoSerializado[] } | { ok: false; mensaje: string }> {
  try {
    const foto = await cargarFotoDeEdicion(editionId);
    if (!foto) return { ok: false, mensaje: "No encontramos esa edición." };
    return { ok: true, atajos: serializarAtajos(calcularAtajosDeReloj(foto)) };
  } catch {
    return { ok: false, mensaje: "No pudimos leer el cronograma de la edición." };
  }
}
