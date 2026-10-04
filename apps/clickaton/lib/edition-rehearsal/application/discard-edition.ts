import "server-only";

import { prisma } from "@/lib/admin/db";
import { sePuedeDescartar } from "./discard-guard";

/**
 * Borra una copia de ensayo, con todo lo que cuelga de ella.
 *
 * Aplica el guardián ANTES de tocar nada. Si el guardián dice que no, no se
 * borra ni una fila y se devuelve el motivo.
 */

export type ResultadoDeBorrado =
  | { ok: true; borrado: Record<string, number> }
  | { ok: false; mensaje: string };

/** Prefijo del correo del participante ficticio del ensayo. */
export const CORREO_DEL_ENSAYO = "ensayo+";
const DOMINIO_DEL_ENSAYO = "@clickaton.test";

export function correoDelEnsayo(editionId: string): string {
  return `${CORREO_DEL_ENSAYO}${editionId}${DOMINIO_DEL_ENSAYO}`;
}

export async function descartarEdicionDeEnsayo(copiaId: string): Promise<ResultadoDeBorrado> {
  const copia = await prisma.clickatonEdition.findUnique({
    where: { id: copiaId },
    select: {
      id: true,
      name: true,
      isOpsFixture: true,
      isPublished: true,
      registrations: { select: { id: true, email: true } },
    },
  });

  const inscripciones = copia?.registrations ?? [];
  const delEnsayo = inscripciones.filter((r) =>
    r.email.toLowerCase().endsWith(DOMINIO_DEL_ENSAYO),
  ).length;

  const veredicto = sePuedeDescartar(
    copia
      ? {
          id: copia.id,
          nombre: copia.name,
          isOpsFixture: copia.isOpsFixture,
          isPublished: copia.isPublished,
          cantidadDeInscripciones: inscripciones.length,
          inscripcionesDelEnsayo: delEnsayo,
        }
      : null,
  );

  if (!veredicto.ok) {
    return { ok: false, mensaje: veredicto.motivo ?? "No se puede borrar esta edición." };
  }

  const borrado: Record<string, number> = {};
  const contar = (clave: string, resultado: { count: number }) => {
    if (resultado.count > 0) borrado[clave] = resultado.count;
  };

  try {
    await prisma.$transaction(async (tx) => {
      const ids = inscripciones.map((r) => r.id);

      contar(
        "decisiones de admisión",
        await tx.clickatonTechnicalAdmissionDecision.deleteMany({ where: { editionId: copiaId } }),
      );
      contar(
        "fotos subidas",
        await tx.clickatonPhotoSubmission.deleteMany({ where: { editionId: copiaId } }),
      );
      if (ids.length > 0) {
        contar(
          "ingresos registrados",
          await tx.clickatonCheckIn.deleteMany({ where: { registrationId: { in: ids } } }),
        );
        contar(
          "credenciales",
          await tx.clickatonParticipantCredential.deleteMany({
            where: { registrationId: { in: ids } },
          }),
        );
        contar(
          "ítems de inscripción",
          await tx.clickatonRegistrationItem.deleteMany({
            where: { registrationId: { in: ids } },
          }),
        );
      }
      contar(
        "reservas de cupo",
        await tx.clickatonCapacityHold.deleteMany({ where: { editionId: copiaId } }),
      );
      contar(
        "inscripciones",
        await tx.clickatonRegistration.deleteMany({ where: { editionId: copiaId } }),
      );
      contar("consignas", await tx.clickatonPrompt.deleteMany({ where: { editionId: copiaId } }));

      const cronogramas = await tx.clickatonEditionTimeline.findMany({
        where: { editionId: copiaId },
        select: { id: true },
      });
      if (cronogramas.length > 0) {
        contar(
          "eventos del cronograma",
          await tx.clickatonTimelineEvent.deleteMany({
            where: { timelineId: { in: cronogramas.map((c) => c.id) } },
          }),
        );
      }
      contar(
        "cronogramas",
        await tx.clickatonEditionTimeline.deleteMany({ where: { editionId: copiaId } }),
      );

      contar(
        "configuración de subida",
        await tx.clickatonEditionUploadConfig.deleteMany({ where: { editionId: copiaId } }),
      );
      contar(
        "configuración de acreditación",
        await tx.clickatonEditionAccreditationConfig.deleteMany({ where: { editionId: copiaId } }),
      );
      contar(
        "configuración de admisión",
        await tx.clickatonEditionAdmissionConfig.deleteMany({ where: { editionId: copiaId } }),
      );
      contar(
        "entradas",
        await tx.clickatonTicketType.deleteMany({ where: { editionId: copiaId } }),
      );
      contar(
        "fases de precio",
        await tx.clickatonRegistrationPricePhase.deleteMany({ where: { editionId: copiaId } }),
      );
      contar(
        "secuencia de códigos",
        await tx.clickatonEditionSequence.deleteMany({ where: { editionId: copiaId } }),
      );

      await tx.clickatonEdition.delete({ where: { id: copiaId } });
      borrado["edición de ensayo"] = 1;
    });

    return { ok: true, borrado };
  } catch {
    return {
      ok: false,
      mensaje: `No pudimos borrar la copia de ensayo (identificador ${copiaId}). Anotá ese identificador: hay que borrarla a mano.`,
    };
  }
}
