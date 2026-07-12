/**
 * Cliente Prisma con escritura hacia la DB operativa de ComprameLaFoto.
 *
 * Preferencia producción: API interna CLF.
 * Staging/dev: CLF_WRITE_DATABASE_URL, o CLF_READONLY_DATABASE_URL
 * si ALLOW_CLF_WRITE_FROM_INFOSPOT=true (misma DB, sin proxy anti-write).
 */

import { PrismaClient } from "@prisma/client";

const globalForClfWrite = globalThis as unknown as {
  clfWritePrisma?: PrismaClient;
  clfWriteUrl?: string;
};

function resolveClfWriteUrl(): string | null {
  const explicit = process.env.CLF_WRITE_DATABASE_URL?.trim();
  if (explicit) return explicit;
  if (process.env.ALLOW_CLF_WRITE_FROM_INFOSPOT === "true") {
    return process.env.CLF_READONLY_DATABASE_URL?.trim() || null;
  }
  return null;
}

export function getClfWriteConnectionInfo(): {
  configured: boolean;
  mode: "CLF_WRITE_DATABASE_URL" | "ALLOW_READONLY_WRITE" | "none";
  hostMasked: string | null;
} {
  const explicit = process.env.CLF_WRITE_DATABASE_URL?.trim();
  if (explicit) {
    try {
      const u = new URL(explicit);
      return {
        configured: true,
        mode: "CLF_WRITE_DATABASE_URL",
        hostMasked: `${u.hostname.slice(0, 14)}…`,
      };
    } catch {
      return { configured: false, mode: "none", hostMasked: null };
    }
  }
  if (process.env.ALLOW_CLF_WRITE_FROM_INFOSPOT === "true") {
    const url = process.env.CLF_READONLY_DATABASE_URL?.trim();
    if (url) {
      try {
        const u = new URL(url);
        return {
          configured: true,
          mode: "ALLOW_READONLY_WRITE",
          hostMasked: `${u.hostname.slice(0, 14)}…`,
        };
      } catch {
        return { configured: false, mode: "none", hostMasked: null };
      }
    }
  }
  return { configured: false, mode: "none", hostMasked: null };
}

export function getClfWriteClient(): PrismaClient {
  const url = resolveClfWriteUrl();
  if (!url) {
    throw new Error(
      "Escritura CLF no configurada. Definí CLF_WRITE_DATABASE_URL o ALLOW_CLF_WRITE_FROM_INFOSPOT=true con CLF_READONLY_DATABASE_URL.",
    );
  }
  if (globalForClfWrite.clfWritePrisma && globalForClfWrite.clfWriteUrl === url) {
    return globalForClfWrite.clfWritePrisma;
  }
  const client = new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  globalForClfWrite.clfWritePrisma = client;
  globalForClfWrite.clfWriteUrl = url;
  return client;
}

export async function disconnectClfWriteClient() {
  if (globalForClfWrite.clfWritePrisma) {
    await globalForClfWrite.clfWritePrisma.$disconnect();
    globalForClfWrite.clfWritePrisma = undefined;
    globalForClfWrite.clfWriteUrl = undefined;
  }
}
