/**
 * En qué base vive un concurso.
 *
 * El portal del jurado es uno solo y está en FotoRank, pero una maratón tiene
 * su concurso, sus obras, sus asignaciones y sus votos en la base de Clickatón.
 * Todo el camino de la rúbrica leía de la base propia y no encontraba nada: por
 * eso nunca funcionó para maratones, y por eso el panel terminaba ofreciendo el
 * motor viejo, que sí elegía la base correcta.
 *
 * La regla es la más simple que se sostiene: **el concurso vive donde está su
 * registro**. Se busca en casa; si no está, se va por el cliente cruzado.
 */
import { prisma } from "@repo/db";
import { getClickatonJuryPrisma } from "@repo/db/clickaton-jury-client";
import { cache } from "react";

import { JuryError } from "./errors";

export const MENSAJE_SIN_ACCESO_A_CLICKATON =
  "No podemos llegar a las obras de esta maratón. Falta la configuración de la conexión " +
  "entre FotoRank y Clickatón; avisale a la organización.";

export type DondeVive = "PROPIA" | "CLICKATON" | "SIN_ACCESO";

export function elegirBase(input: {
  estaEnLaBasePropia: boolean;
  hayClienteCruzado: boolean;
}): DondeVive {
  if (input.estaEnLaBasePropia) return "PROPIA";
  return input.hayClienteCruzado ? "CLICKATON" : "SIN_ACCESO";
}

/**
 * El tipo sale de `prisma`, no de `@prisma/client`.
 *
 * Son dos declaraciones distintas del mismo cliente y TypeScript no las
 * reconcilia: compararlas da "excessive stack depth". Tomando el tipo del
 * cliente que ya usa la app, las dos puntas hablan el mismo idioma.
 */
export type ClienteDeJurado = typeof prisma;

export type BaseDelConcurso = {
  db: ClienteDeJurado;
  esDeClickaton: boolean;
};

/**
 * El cliente con el que hay que leer y escribir este concurso.
 *
 * Va con `cache()` de React porque lo llaman varias funciones dentro de la
 * misma pantalla y ninguna necesita preguntar dos veces lo mismo.
 */
export const baseDelConcurso = cache(async function baseDelConcurso(
  contestId: string,
): Promise<BaseDelConcurso> {
  const propio = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: { id: true },
  });

  const cruzado = getClickatonJuryPrisma();
  const donde = elegirBase({
    estaEnLaBasePropia: Boolean(propio),
    hayClienteCruzado: Boolean(cruzado),
  });

  if (donde === "PROPIA") return { db: prisma, esDeClickaton: false };
  if (donde === "CLICKATON") {
    return { db: cruzado as unknown as ClienteDeJurado, esDeClickaton: true };
  }

  throw new JuryError("CONTEST_NOT_FOUND", MENSAJE_SIN_ACCESO_A_CLICKATON, 503);
});
