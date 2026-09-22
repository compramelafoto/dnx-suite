import { prisma, withClickatonDb, type ClickatonDbResult } from "@/lib/admin/db";
import type { ReadinessResult } from "@/lib/readiness/domain/readiness";

/** Todos los resultados salvo READY, en el mismo orden que declara el dominio. */
const NOT_READY_RESULTS: Exclude<ReadinessResult, "READY">[] = [
  "NO_GPS",
  "CLOCK_OFF",
  "TOO_SMALL",
  "NO_CAPTURE_DATE",
  "FAILED",
];

export type ReadinessBreakdownItem = {
  result: Exclude<ReadinessResult, "READY">;
  count: number;
};

export type ReadinessDashboardData = {
  /**
   * Inscripciones CONFIRMED de la edición: el mismo filtro con el que se
   * manda el mail que trae el enlace de esta prueba (confirmación de pago o
   * de inscripción gratuita, ver `sendParticipantFunnelEmail`), así que es
   * quien puede llegar a aparecer en el mapa el día del evento.
   */
  totalRegistrations: number;
  /** Su última prueba dio READY. */
  ready: number;
  /** Probaron y su última prueba no dio READY, desglosado por resultado. */
  notReady: ReadinessBreakdownItem[];
  /**
   * Nunca probaron: ni una fila en `ClickatonReadinessCheck`. Distinto de
   * "probó y le falta algo" — a éstos se les manda el enlace, no la
   * instrucción de qué arreglar. Es el número más importante: a quién hay
   * que ir a buscar.
   */
  neverChecked: number;
};

/**
 * Por edición, cuántos inscriptos confirmados ya probaron si su teléfono
 * guarda la ubicación en las fotos.
 *
 * Cuenta la ÚLTIMA prueba de cada inscripción, no todas las filas: se
 * guardan todos los intentos a propósito (alguien que arregla el teléfono
 * vuelve a probar), así que contar filas haría que quien probó cinco veces
 * cuente cinco. Para evitarlo se traen todas las filas de la edición
 * ordenadas por `checkedAt` descendente y, por inscripción, se toma sólo la
 * primera que aparece — que es la más reciente — descartando el resto.
 */
export async function getEditionReadinessDashboard(
  editionId: string,
): Promise<ClickatonDbResult<ReadinessDashboardData>> {
  return withClickatonDb(async () => {
    const [registrations, checks] = await Promise.all([
      prisma.clickatonRegistration.findMany({
        where: { editionId, status: "CONFIRMED" },
        select: { id: true },
      }),
      prisma.clickatonReadinessCheck.findMany({
        where: { editionId },
        orderBy: { checkedAt: "desc" },
        select: { registrationId: true, result: true },
      }),
    ]);

    const confirmedIds = new Set(registrations.map((r) => r.id));

    // Ordenado por checkedAt desc: la primera vez que aparece cada
    // registrationId en este recorrido es su prueba más reciente. Si vuelve
    // a aparecer (probó varias veces) ya está registrada y se ignora.
    const lastResultByRegistration = new Map<string, ReadinessResult>();
    for (const check of checks) {
      if (!confirmedIds.has(check.registrationId)) continue;
      if (lastResultByRegistration.has(check.registrationId)) continue;
      lastResultByRegistration.set(
        check.registrationId,
        check.result as ReadinessResult,
      );
    }

    let ready = 0;
    const notReadyCounts = new Map<Exclude<ReadinessResult, "READY">, number>();
    for (const result of lastResultByRegistration.values()) {
      if (result === "READY") {
        ready += 1;
      } else {
        notReadyCounts.set(result, (notReadyCounts.get(result) ?? 0) + 1);
      }
    }

    const notReady = NOT_READY_RESULTS.map((result) => ({
      result,
      count: notReadyCounts.get(result) ?? 0,
    }));

    return {
      totalRegistrations: confirmedIds.size,
      ready,
      notReady,
      neverChecked: confirmedIds.size - lastResultByRegistration.size,
    };
  }, "No se pudo calcular cuántos inscriptos ya probaron su teléfono.");
}
