/**
 * Cliente Prisma de solo lectura para datos ComprameLaFoto.
 * Variable: CLF_READONLY_DATABASE_URL
 * Nunca migraciones / seeds / escrituras.
 */

import { PrismaClient } from "@prisma/client";

const WRITE_METHODS = new Set([
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
  "executeRaw",
  "executeRawUnsafe",
  "$executeRaw",
  "$executeRawUnsafe",
]);

const BLOCKED_CLIENT_METHODS = new Set([
  "$executeRaw",
  "$executeRawUnsafe",
  "$transaction",
]);

export type ClfReadonlyConnectionInfo = {
  configured: boolean;
  hostMasked: string | null;
  databaseName: string | null;
  isBlockedStagingEmptyHost: boolean;
  reason?: string;
};

const BLOCKED_HOST_FRAGMENTS = ["ep-dawn-dew-adyr8f1v"];

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

export function getClfReadonlyConnectionInfo(): ClfReadonlyConnectionInfo {
  const url = process.env.CLF_READONLY_DATABASE_URL?.trim();
  if (!url) {
    return {
      configured: false,
      hostMasked: null,
      databaseName: null,
      isBlockedStagingEmptyHost: false,
      reason: "CLF_READONLY_DATABASE_URL no está configurada",
    };
  }
  const masked = maskHost(url);
  if (!masked) {
    return {
      configured: false,
      hostMasked: null,
      databaseName: null,
      isBlockedStagingEmptyHost: false,
      reason: "CLF_READONLY_DATABASE_URL inválida",
    };
  }
  const isBlocked = BLOCKED_HOST_FRAGMENTS.some((f) => url.includes(f));
  if (isBlocked) {
    return {
      configured: false,
      hostMasked: masked.hostMasked,
      databaseName: masked.databaseName,
      isBlockedStagingEmptyHost: true,
      reason:
        "La URL apunta al host de staging Info Spot (sin datos CLF). Usá la DB real de ComprameLaFoto en solo lectura.",
    };
  }
  return {
    configured: true,
    hostMasked: masked.hostMasked,
    databaseName: masked.databaseName,
    isBlockedStagingEmptyHost: false,
  };
}

function assertClfReadonlyConfigured(): string {
  const info = getClfReadonlyConnectionInfo();
  if (!info.configured) {
    throw new Error(info.reason || "CLF_READONLY_DATABASE_URL no disponible");
  }
  return process.env.CLF_READONLY_DATABASE_URL!.trim();
}

function createWriteGuardProxy<T extends object>(target: T, path: string): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      const key = String(prop);
      if (typeof prop === "symbol") {
        return Reflect.get(obj, prop, receiver);
      }

      if (BLOCKED_CLIENT_METHODS.has(key) || (path === "" && WRITE_METHODS.has(key))) {
        return () => {
          throw new Error(
            `CLF read-only: operación bloqueada (${path ? `${path}.` : ""}${key}). Solo SELECT/find*.`,
          );
        };
      }

      const value = Reflect.get(obj, prop, receiver);
      if (value == null) return value;

      if (path === "" && typeof value === "object" && !Array.isArray(value)) {
        return createWriteGuardProxy(value as object, key);
      }

      if (typeof value === "function") {
        if (WRITE_METHODS.has(key)) {
          return () => {
            throw new Error(`CLF read-only: escritura bloqueada en ${path}.${key}.`);
          };
        }
        return value.bind(obj);
      }

      return value;
    },
  });
}

type GlobalClf = {
  clfReadonlyPrisma?: PrismaClient;
  clfReadonlyUrl?: string;
};

const globalForClf = globalThis as unknown as GlobalClf;

function getRawClfPrisma(): PrismaClient {
  const url = assertClfReadonlyConfigured();
  if (globalForClf.clfReadonlyPrisma && globalForClf.clfReadonlyUrl === url) {
    return globalForClf.clfReadonlyPrisma;
  }
  const client = new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  globalForClf.clfReadonlyPrisma = client;
  globalForClf.clfReadonlyUrl = url;
  return client;
}

export function getClfReadonlyClient(): PrismaClient {
  return createWriteGuardProxy(getRawClfPrisma(), "") as PrismaClient;
}

export async function disconnectClfReadonlyClient(): Promise<void> {
  if (globalForClf.clfReadonlyPrisma) {
    await globalForClf.clfReadonlyPrisma.$disconnect();
    globalForClf.clfReadonlyPrisma = undefined;
    globalForClf.clfReadonlyUrl = undefined;
  }
}

export async function probeClfReadonlyConnection(): Promise<{
  ok: boolean;
  info: ClfReadonlyConnectionInfo;
  counts?: { events: number; albums: number; photos: number; users: number };
  error?: string;
}> {
  const info = getClfReadonlyConnectionInfo();
  if (!info.configured) {
    return { ok: false, info, error: info.reason };
  }
  try {
    const client = getClfReadonlyClient();
    const [events, albums, photos, users] = await Promise.all([
      client.event.count(),
      client.album.count({ where: { deletedAt: null } }),
      client.photo.count({ where: { isRemoved: false } }),
      client.user.count(),
    ]);
    if (events === 0 && albums === 0) {
      return {
        ok: false,
        info,
        counts: { events, albums, photos, users },
        error: "Conexión OK pero sin eventos/álbumes — posible DB vacía o incorrecta",
      };
    }
    return { ok: true, info, counts: { events, albums, photos, users } };
  } catch (e) {
    return {
      ok: false,
      info,
      error: e instanceof Error ? e.message : "Error de conexión CLF",
    };
  }
}
