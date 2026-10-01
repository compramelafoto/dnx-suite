/**
 * Cliente Prisma de FotoRank hacia la base operativa de Clickatón, CON
 * escritura. Variable: CLICKATON_JURY_DATABASE_URL
 *
 * Por qué existe: el portal del jurado vive en FotoRank, pero las obras de una
 * maratón y sus votos viven en la base de Clickatón. Las claves foráneas no
 * cruzan bases — `FotorankJudgeVote` apunta a la asignación y a la obra a la
 * vez —, así que el voto tiene que escribirse del lado donde está la obra.
 *
 * Se diferencia de `clickaton-readonly-client.ts` en que este SÍ escribe, y por
 * eso es la única puerta autorizada para hacerlo: acotada al circuito de
 * evaluación, nunca para migraciones ni seeds.
 */

import { PrismaClient } from "@prisma/client";

/**
 * Hosts que esta conexión NO debe apuntar nunca.
 *
 * `ep-dawn-dew-adyr8f1v` es la base que usa FotoRank en producción. Si la
 * variable apuntara ahí, el portal escribiría los votos de una maratón en su
 * propia base creyendo que escribe en la de Clickatón, y el trabajo del jurado
 * quedaría separado de las obras. Mismo bloqueo explícito que usa el cliente de
 * sólo lectura.
 */
const BLOCKED_HOST_FRAGMENTS = ["ep-dawn-dew-adyr8f1v"];

const globalForClickatonJury = globalThis as unknown as {
  clickatonJuryPrisma?: PrismaClient;
};

export type ClickatonJuryConnectionInfo = {
  configured: boolean;
  hostMasked: string | null;
  databaseName: string | null;
  reason?: string;
};

function maskHost(url: string): { hostMasked: string; databaseName: string } | null {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const parts = host.split(".");
    const masked =
      parts.length >= 2
        ? `${parts[0]!.slice(0, 12)}…${parts.slice(-2).join(".")}`
        : `${host.slice(0, 16)}…`;
    const databaseName = u.pathname.replace(/^\//, "").split("?")[0] || "unknown";
    return { hostMasked: masked, databaseName };
  } catch {
    return null;
  }
}

export function getClickatonJuryConnectionInfo(): ClickatonJuryConnectionInfo {
  const url = process.env.CLICKATON_JURY_DATABASE_URL?.trim();
  if (!url) {
    return {
      configured: false,
      hostMasked: null,
      databaseName: null,
      reason: "CLICKATON_JURY_DATABASE_URL no está configurada",
    };
  }
  const masked = maskHost(url);
  if (!masked) {
    return {
      configured: false,
      hostMasked: null,
      databaseName: null,
      reason: "CLICKATON_JURY_DATABASE_URL inválida",
    };
  }
  if (BLOCKED_HOST_FRAGMENTS.some((f) => url.includes(f))) {
    return {
      configured: false,
      hostMasked: masked.hostMasked,
      databaseName: masked.databaseName,
      reason:
        "La URL apunta a la base propia de FotoRank, no a la de Clickatón. Usá la base donde viven las obras de la maratón.",
    };
  }
  return {
    configured: true,
    hostMasked: masked.hostMasked,
    databaseName: masked.databaseName,
  };
}

/**
 * Cliente hacia la base de Clickatón, o `null` si no está configurada.
 *
 * Devuelve `null` en vez de lanzar para que el panel del jurado pueda mostrar
 * las asignaciones propias y avisar por las que faltan, en lugar de romperse
 * entero.
 */
export function getClickatonJuryPrisma(): PrismaClient | null {
  const info = getClickatonJuryConnectionInfo();
  if (!info.configured) return null;

  if (!globalForClickatonJury.clickatonJuryPrisma) {
    globalForClickatonJury.clickatonJuryPrisma = new PrismaClient({
      datasources: { db: { url: process.env.CLICKATON_JURY_DATABASE_URL!.trim() } },
    });
  }
  return globalForClickatonJury.clickatonJuryPrisma;
}
