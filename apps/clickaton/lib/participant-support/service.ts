import { prisma } from "@repo/db";

import { ESTADOS_ENTREGADA } from "@/lib/participant-live/service";
import { puedeVerLaPantallaDelParticipante } from "@/lib/participant-live/acceso";
import type { ActorDePantalla } from "@/lib/participant-live/acceso";
import { estadoDeFinalizacion } from "./finalizar-entrega";

export class FinalizarEntregaError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "FORBIDDEN" | "SIN_FOTOS",
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "FinalizarEntregaError";
  }
}

export type EntregaFinalizada = {
  finalizadaEn: string;
  fotosEnviadas: number;
  yaEstaba: boolean;
};

/**
 * Marca la entrega como terminada por decisión del participante.
 *
 * Idempotente: si ya estaba finalizada devuelve la marca original en vez de
 * pisarla. Alguien que aprieta dos veces no debe cambiar su propia hora de
 * cierre.
 */
export async function finalizarEntregaDelParticipante(input: {
  registrationId: string;
  actor: ActorDePantalla;
  ahora?: Date;
}): Promise<EntregaFinalizada> {
  const registration = await prisma.clickatonRegistration.findUnique({
    where: { id: input.registrationId },
    select: {
      id: true,
      userId: true,
      email: true,
      submissionFinalizedAt: true,
      edition: { select: { isOpsFixture: true } },
    },
  });
  if (!registration) {
    throw new FinalizarEntregaError("NOT_FOUND", "No encontramos esa inscripción.", 404);
  }

  const permitido = puedeVerLaPantallaDelParticipante(input.actor, {
    userId: registration.userId,
    email: registration.email,
    edicionEsCopiaDeEnsayo: registration.edition.isOpsFixture === true,
  });
  if (!permitido) {
    throw new FinalizarEntregaError("FORBIDDEN", "Esta inscripción no es tuya.", 403);
  }

  const fotosEnviadas = await prisma.clickatonPhotoSubmission.count({
    where: { registrationId: registration.id, status: { in: [...ESTADOS_ENTREGADA] } },
  });

  if (registration.submissionFinalizedAt) {
    return {
      finalizadaEn: registration.submissionFinalizedAt.toISOString(),
      fotosEnviadas,
      yaEstaba: true,
    };
  }

  const estado = estadoDeFinalizacion({
    finalizadaEn: null,
    fotosEnviadas,
    entregaAbierta: true,
  });
  if (estado === "SIN_FOTOS") {
    throw new FinalizarEntregaError(
      "SIN_FOTOS",
      "Todavía no subiste ninguna foto, así que no hay entrega para cerrar.",
      409,
    );
  }

  const ahora = input.ahora ?? new Date();
  await prisma.clickatonRegistration.update({
    where: { id: registration.id },
    data: { submissionFinalizedAt: ahora },
  });

  return { finalizadaEn: ahora.toISOString(), fotosEnviadas, yaEstaba: false };
}
