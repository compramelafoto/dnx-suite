import "server-only";
import { prisma } from "@repo/db";

/**
 * A cuáles de estas direcciones ya les salió este correo.
 *
 * Existe para poder reintentar un envío masivo sin volver a escribirle a quien ya lo recibió.
 * `SentEmailLog` es el único registro de qué salió y qué no (ver `sendAndLogEmail`), así que es
 * ahí donde hay que preguntar.
 *
 * **Vive en `lib/communications` y no en `lib/coverages/repository.ts` a propósito.** La regla
 * del módulo de coberturas es que toda consulta lleve `workspaceId` en su `where`, y
 * `SentEmailLog` no tiene esa columna: meterla ahí obligaría a abrirle una excepción a la
 * barrera de aislamiento por una tabla que ni siquiera es del módulo. El aislamiento acá lo pone
 * quien llama: `candidatos` son las direcciones del padrón de un workspace, ya filtradas, y la
 * consulta no puede devolver ninguna que no esté en esa lista.
 *
 * `subject` y `desde` juntos identifican una corrida: el asunto lleva el título de la
 * convocatoria y el nombre de la institución, y `desde` la acota a partir de que se publicó.
 * Sin `desde`, un correo con el mismo asunto de hace un año contaría como "ya avisado".
 *
 * Solo cuentan los `SENT`: un envío que el proveedor rechazó es justamente el que hay que
 * reintentar.
 */
export async function direccionesConEnvioExitoso(input: {
  templateKey: string;
  subject: string;
  desde: Date;
  candidatos: readonly string[];
}): Promise<Set<string>> {
  if (input.candidatos.length === 0) return new Set();

  const filas = await prisma.sentEmailLog.findMany({
    where: {
      templateKey: input.templateKey,
      subject: input.subject,
      status: "SENT",
      createdAt: { gte: input.desde },
      to: { in: [...input.candidatos] },
    },
    select: { to: true },
  });

  return new Set(filas.map((f) => f.to.trim().toLowerCase()));
}
