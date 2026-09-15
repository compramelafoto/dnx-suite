import "server-only";
import type { Prisma } from "@repo/db";
import type { EstadoDeRol } from "./cupos";
import { efectosSobreLaBusqueda } from "./equipo";
import { recordEvent } from "./events";
import { ASSIGNMENT_LIVE_STATUSES } from "./states";

/**
 * Lo que le pasa a la convocatoria y a la cobertura cada vez que se toca el equipo.
 *
 * Vive acá y no repetido en cada acción porque es exactamente el mismo recálculo lo mire quien
 * lo mire: seleccionar una postulación, invitar directo, confirmar o avisar que no se puede.
 * Que una de las cuatro se olvidara de recalcular es cómo una cobertura queda diciendo que
 * tiene equipo cuando ya no lo tiene.
 *
 * **Se llama SIEMPRE dentro de la transacción que escribió el cambio**, con el mismo `tx`: la
 * decisión de estado y la escritura que la provoca tienen que confirmarse juntas o no
 * confirmarse. Por eso vuelve a leer los roles desde la base en vez de recibirlos — adentro de
 * la transacción, esa lectura ya ve la asignación recién escrita.
 */
export async function aplicarEfectosSobreLaBusqueda(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    coverageId: string;
    actorUserId: number | null;
    actorLabel: string | null;
  },
): Promise<void> {
  const cobertura = await tx.coverage.findFirst({
    where: { id: input.coverageId, workspaceId: input.workspaceId },
    select: {
      id: true,
      status: true,
      roles: { select: { vacancies: true, assignments: { select: { status: true } } } },
      call: { select: { id: true, status: true } },
    },
  });
  if (!cobertura) return;

  const roles: EstadoDeRol[] = cobertura.roles.map((r) => ({
    vacancies: r.vacancies,
    asignadasVivas: r.assignments.filter((a) =>
      (ASSIGNMENT_LIVE_STATUSES as readonly string[]).includes(a.status),
    ).length,
    asignadasAceptadas: r.assignments.filter(
      (a) => a.status === "ACEPTADA" || a.status === "CONFIRMADA",
    ).length,
  }));

  const efectos = efectosSobreLaBusqueda({
    roles,
    callStatus: cobertura.call?.status ?? null,
    coverageStatus: cobertura.status,
  });

  if (efectos.callStatus !== null && cobertura.call) {
    await tx.coverageCall.update({
      where: { id: cobertura.call.id },
      data: { status: efectos.callStatus },
    });
    await recordEvent(tx, {
      workspaceId: input.workspaceId,
      entityType: "CALL",
      entityId: cobertura.call.id,
      type: "ESTADO_CAMBIADO",
      fromStatus: cobertura.call.status,
      toStatus: efectos.callStatus,
      actorUserId: input.actorUserId,
      actorLabel: input.actorLabel,
    });
  }

  if (efectos.coverageStatus !== null) {
    await tx.coverage.update({
      where: { id: cobertura.id },
      data: { status: efectos.coverageStatus },
    });
    await recordEvent(tx, {
      workspaceId: input.workspaceId,
      entityType: "COVERAGE",
      entityId: cobertura.id,
      type: "ESTADO_CAMBIADO",
      fromStatus: cobertura.status,
      toStatus: efectos.coverageStatus,
      actorUserId: input.actorUserId,
      actorLabel: input.actorLabel,
    });
  }
}
