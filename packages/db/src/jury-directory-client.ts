/**
 * Cliente Prisma hacia el padrón maestro de jurados, que vive en la base de
 * FotoRank. Variable: JURY_DIRECTORY_DATABASE_URL
 *
 * Por qué existe: el padrón es uno solo para toda la suite, pero cada
 * aplicación usa su propia base. Clickatón necesita dar de alta y consultar
 * jurados sin crear un padrón paralelo — que es exactamente lo que pasaría si
 * escribiera con su cliente habitual.
 *
 * No confundir con `mirrorJudgeAccount` de Clickatón: esa copia local existe
 * sólo para que cierren las claves foráneas y nunca autentica a nadie.
 */

import { PrismaClient } from "@prisma/client";

const globalForJuryDirectory = globalThis as unknown as {
  juryDirectoryPrisma?: PrismaClient;
};

export type JuryDirectoryConnectionInfo = {
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

export function getJuryDirectoryConnectionInfo(): JuryDirectoryConnectionInfo {
  const url = process.env.JURY_DIRECTORY_DATABASE_URL?.trim();
  if (!url) {
    return {
      configured: false,
      hostMasked: null,
      databaseName: null,
      reason: "JURY_DIRECTORY_DATABASE_URL no está configurada",
    };
  }
  const masked = maskHost(url);
  if (!masked) {
    return {
      configured: false,
      hostMasked: null,
      databaseName: null,
      reason: "JURY_DIRECTORY_DATABASE_URL inválida",
    };
  }
  return {
    configured: true,
    hostMasked: masked.hostMasked,
    databaseName: masked.databaseName,
  };
}

/**
 * Cliente del padrón maestro, o `null` si no está configurado.
 *
 * Devuelve `null` en vez de lanzar para que la pantalla pueda avisar "el padrón
 * no está disponible" en lugar de crear una cuenta local que nadie podría usar
 * para entrar.
 */
export function getJuryDirectoryPrisma(): PrismaClient | null {
  const info = getJuryDirectoryConnectionInfo();
  if (!info.configured) return null;

  if (!globalForJuryDirectory.juryDirectoryPrisma) {
    globalForJuryDirectory.juryDirectoryPrisma = new PrismaClient({
      datasources: { db: { url: process.env.JURY_DIRECTORY_DATABASE_URL!.trim() } },
    });
  }
  return globalForJuryDirectory.juryDirectoryPrisma;
}
