/**
 * Cliente Prisma de SOLO LECTURA hacia la base de Clickatón.
 * Variable: CLICKATON_READONLY_DATABASE_URL
 *
 * Por qué existe: en producción cada aplicación del monorepo usa su propia
 * base, aunque compartan el mismo `schema.prisma`. FotoRank no puede leer las
 * ediciones de Clickatón con su cliente habitual: consultaría su propia base y
 * no encontraría nada (o, peor, encontraría filas residuales que no
 * corresponden). Este cliente apunta explícitamente a la base del otro producto.
 *
 * Nunca migraciones, seeds ni escrituras: el proxy bloquea toda operación que
 * no sea de lectura, incluso si alguien la invoca por error más adelante.
 *
 * Mismo patrón que `clf-readonly-client.ts`, que ya se usa para ComprameLaFoto.
 */

import { PrismaClient } from "@prisma/client";

const WRITE_METHODS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
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

const BLOCKED_CLIENT_METHODS = new Set(["$executeRaw", "$executeRawUnsafe", "$transaction"]);

/**
 * Hosts que esta conexión NO debe apuntar nunca.
 *
 * `ep-dawn-dew-adyr8f1v` es la base que usa FotoRank en producción. Si la
 * variable apuntara ahí, el listado leería la propia base creyendo que lee la
 * de Clickatón: no encontraría las ediciones reales y podría publicar filas
 * residuales como si fueran convocatorias vigentes. Es exactamente el error que
 * este cliente viene a corregir, así que se bloquea de forma explícita.
 */
const BLOCKED_HOST_FRAGMENTS = ["ep-dawn-dew-adyr8f1v"];

export type ClickatonReadonlyConnectionInfo = {
  configured: boolean;
  /** Host parcialmente oculto: sirve para diagnosticar sin exponer la credencial. */
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

export function getClickatonReadonlyConnectionInfo(): ClickatonReadonlyConnectionInfo {
  const url = process.env.CLICKATON_READONLY_DATABASE_URL?.trim();
  if (!url) {
    return {
      configured: false,
      hostMasked: null,
      databaseName: null,
      reason: "CLICKATON_READONLY_DATABASE_URL no está configurada",
    };
  }
  const masked = maskHost(url);
  if (!masked) {
    return {
      configured: false,
      hostMasked: null,
      databaseName: null,
      reason: "CLICKATON_READONLY_DATABASE_URL inválida",
    };
  }
  if (BLOCKED_HOST_FRAGMENTS.some((f) => url.includes(f))) {
    return {
      configured: false,
      hostMasked: masked.hostMasked,
      databaseName: masked.databaseName,
      reason:
        "La URL apunta a la base propia de FotoRank, no a la de Clickatón. Usá la base donde viven las ediciones.",
    };
  }
  return {
    configured: true,
    hostMasked: masked.hostMasked,
    databaseName: masked.databaseName,
  };
}

function createWriteGuardProxy<T extends object>(target: T, path: string): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      const key = String(prop);
      if (typeof prop === "symbol") return Reflect.get(obj, prop, receiver);

      if (BLOCKED_CLIENT_METHODS.has(key) || (path === "" && WRITE_METHODS.has(key))) {
        return () => {
          throw new Error(
            `Clickatón read-only: operación bloqueada (${path ? `${path}.` : ""}${key}). Solo SELECT/find*.`,
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
            throw new Error(`Clickatón read-only: escritura bloqueada en ${path}.${key}.`);
          };
        }
        return value.bind(obj);
      }

      return value;
    },
  });
}

type GlobalClickaton = {
  clickatonReadonlyPrisma?: PrismaClient;
  clickatonReadonlyUrl?: string;
};

const globalForClickaton = globalThis as unknown as GlobalClickaton;

function getRawClickatonPrisma(): PrismaClient {
  const info = getClickatonReadonlyConnectionInfo();
  if (!info.configured) {
    throw new Error(info.reason || "CLICKATON_READONLY_DATABASE_URL no disponible");
  }
  const url = process.env.CLICKATON_READONLY_DATABASE_URL!.trim();
  if (globalForClickaton.clickatonReadonlyPrisma && globalForClickaton.clickatonReadonlyUrl === url) {
    return globalForClickaton.clickatonReadonlyPrisma;
  }
  const client = new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  globalForClickaton.clickatonReadonlyPrisma = client;
  globalForClickaton.clickatonReadonlyUrl = url;
  return client;
}

/** Lanza si la variable no está configurada. Para uso opcional, ver `isClickatonReadonlyAvailable`. */
export function getClickatonReadonlyClient(): PrismaClient {
  return createWriteGuardProxy(getRawClickatonPrisma(), "") as PrismaClient;
}

/** Permite decidir sin capturar excepciones cuando la conexión es opcional. */
export function isClickatonReadonlyAvailable(): boolean {
  return getClickatonReadonlyConnectionInfo().configured;
}

export async function disconnectClickatonReadonlyClient(): Promise<void> {
  if (globalForClickaton.clickatonReadonlyPrisma) {
    await globalForClickaton.clickatonReadonlyPrisma.$disconnect();
    globalForClickaton.clickatonReadonlyPrisma = undefined;
    globalForClickaton.clickatonReadonlyUrl = undefined;
  }
}

/** Diagnóstico: confirma que la URL apunta a una base con ediciones. */
export async function probeClickatonReadonlyConnection(): Promise<{
  ok: boolean;
  info: ClickatonReadonlyConnectionInfo;
  counts?: { editions: number; publishedEditions: number };
  error?: string;
}> {
  const info = getClickatonReadonlyConnectionInfo();
  if (!info.configured) return { ok: false, info, error: info.reason };

  try {
    const client = getClickatonReadonlyClient();
    const [editions, publishedEditions] = await Promise.all([
      client.clickatonEdition.count(),
      client.clickatonEdition.count({ where: { isPublished: true } }),
    ]);
    if (editions === 0) {
      return {
        ok: false,
        info,
        counts: { editions, publishedEditions },
        error: "Conexión OK pero sin ediciones — probablemente no es la base de Clickatón",
      };
    }
    return { ok: true, info, counts: { editions, publishedEditions } };
  } catch (e) {
    return {
      ok: false,
      info,
      error: e instanceof Error ? e.message : "Error de conexión Clickatón",
    };
  }
}
