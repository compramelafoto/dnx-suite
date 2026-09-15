import "server-only";
import { cache } from "react";
import { prisma } from "@repo/db";
import { personTermsFromRow, personVocabulary, type PersonVocabulary } from "./personas";

/**
 * El vocabulario de un workspace, leído una sola vez por pedido.
 *
 * Va envuelto en `cache` de React porque en una misma pantalla lo piden el layout, el menú
 * lateral y el cuerpo de la página. Sin eso serían tres consultas idénticas para traer dos
 * palabras.
 *
 * Un workspace sin fila devuelve el vocabulario por omisión —socio y socios—, que es lo que
 * el sistema decía antes de que esto existiera. Ninguna institución ve nada distinto hasta
 * que alguien configura sus palabras.
 */
export const loadPersonVocabulary = cache(
  async (workspaceId: string): Promise<PersonVocabulary> => {
    const fila = await prisma.workspaceVocabulary.findUnique({
      where: { workspaceId },
      select: { personSingular: true, personPlural: true },
    });
    return personVocabulary(personTermsFromRow(fila));
  },
);
