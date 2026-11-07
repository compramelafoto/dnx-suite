import {
  APP_FOTOFFICE,
  PREFIJO_LLAVE,
  VENCIMIENTO_CODIGO_MS,
  generarSecreto,
  hashSecreto,
  recortarNombreEspacio,
} from "./llaves";

/**
 * Conexión FOTOFFICE ↔ CLF (etapa 2): códigos de un solo uso y llaves de acceso.
 * CLF guarda sólo hashes. La base se recibe por parámetro (por omisión, el Prisma de CLF) para poder probarlo.
 */

type Fila = Record<string, unknown>;
type Modelo = {
  create(args: { data: Fila; select?: Fila }): Promise<any>;
  findUnique(args: { where: Fila; select?: Fila }): Promise<any>;
  findMany(args: Fila): Promise<any[]>;
  update(args: { where: Fila; data: Fila; select?: Fila }): Promise<any>;
  updateMany(args: { where: Fila; data: Fila }): Promise<{ count: number }>;
};

/** Lo mínimo de Prisma que usa este módulo. */
export type BaseConexion = {
  clfAppConnectCode: Pick<Modelo, "create" | "findUnique" | "updateMany">;
  clfAppConnection: Pick<Modelo, "create" | "findUnique" | "findMany" | "update" | "updateMany">;
  user: Pick<Modelo, "findUnique">;
  $transaction<T>(fn: (tx: BaseConexion) => Promise<T>): Promise<T>;
};

export type DepsConexion = { db?: BaseConexion; ahora?: () => Date };

async function base(deps?: DepsConexion): Promise<BaseConexion> {
  if (deps?.db) return deps.db;
  const { prisma } = await import("@/lib/prisma");
  return prisma as unknown as BaseConexion;
}
const ahoraDe = (deps?: DepsConexion) => (deps?.ahora ? deps.ahora() : new Date());

const FORMA_CODIGO = /^[A-Za-z0-9_-]{43}$/;
const FORMA_LLAVE = /^clf_fo_[A-Za-z0-9_-]{43}$/;

export type CuentaParaFotoffice = { id: number; nombre: string; mpUserId: string | null };

/** Crea un código de un solo uso (2 minutos) y devuelve el código en claro; en la base queda sólo el hash. */
export async function crearCodigo(
  params: { userId: number; externalLabel: string; returnUrl: string },
  deps?: DepsConexion,
): Promise<string> {
  const db = await base(deps);
  const codigo = generarSecreto();
  await db.clfAppConnectCode.create({
    data: {
      codeHash: hashSecreto(codigo),
      userId: params.userId,
      appKey: APP_FOTOFFICE,
      externalLabel: recortarNombreEspacio(params.externalLabel) || "FOTOFFICE",
      returnUrl: params.returnUrl,
      expiresAt: new Date(ahoraDe(deps).getTime() + VENCIMIENTO_CODIGO_MS),
    },
    select: { id: true },
  });
  return codigo;
}

/**
 * Canjea un código por una llave, una sola vez. Dentro de una transacción, marca `usedAt` sólo si el código
 * existe, no se usó y no venció (un UPDATE condicional: si dos pedidos llegan juntos, sólo uno lo gana).
 * Devuelve null si el código no sirve.
 */
export async function canjearCodigo(
  codigo: string,
  deps?: DepsConexion,
): Promise<{ llave: string; cuenta: CuentaParaFotoffice } | null> {
  if (typeof codigo !== "string" || !FORMA_CODIGO.test(codigo)) return null;
  const db = await base(deps);
  const ahora = ahoraDe(deps);
  const codeHash = hashSecreto(codigo);

  return db.$transaction(async (tx) => {
    const marcado = await tx.clfAppConnectCode.updateMany({
      where: { codeHash, appKey: APP_FOTOFFICE, usedAt: null, expiresAt: { gt: ahora } },
      data: { usedAt: ahora },
    });
    if (marcado.count !== 1) return null;

    const c = (await tx.clfAppConnectCode.findUnique({
      where: { codeHash },
      select: { userId: true, externalLabel: true },
    })) as { userId: number; externalLabel: string } | null;
    if (!c) return null;
    const u = (await tx.user.findUnique({
      where: { id: c.userId },
      select: { id: true, name: true, mpUserId: true },
    })) as { id: number; name: string | null; mpUserId: string | null } | null;
    if (!u) return null;

    const llave = generarSecreto(PREFIJO_LLAVE);
    await tx.clfAppConnection.create({
      data: {
        userId: u.id,
        appKey: APP_FOTOFFICE,
        externalLabel: c.externalLabel,
        keyHash: hashSecreto(llave),
        keyPrefix: llave.slice(0, PREFIJO_LLAVE.length + 4),
      },
      select: { id: true },
    });
    return {
      llave,
      cuenta: { id: u.id, nombre: (u.name ?? "").trim().slice(0, 200) || `Cuenta ${u.id}`, mpUserId: u.mpUserId ?? null },
    };
  });
}

/** Usuario dueño de una llave activa (no revocada). Anota `lastUsedAt`. */
export async function usuarioDeLlave(llave: string | null, deps?: DepsConexion): Promise<{ userId: number } | null> {
  if (typeof llave !== "string" || !FORMA_LLAVE.test(llave)) return null;
  const db = await base(deps);
  const fila = (await db.clfAppConnection.findUnique({
    where: { keyHash: hashSecreto(llave) },
    select: { id: true, userId: true, appKey: true, revokedAt: true },
  })) as { id: string; userId: number; appKey: string; revokedAt: Date | null } | null;
  if (!fila || fila.revokedAt || fila.appKey !== APP_FOTOFFICE) return null;
  await db.clfAppConnection.update({ where: { id: fila.id }, data: { lastUsedAt: ahoraDe(deps) }, select: { id: true } });
  return { userId: fila.userId };
}

/** Revoca la llave (la usa FOTOFFICE al desconectar). Idempotente. */
export async function revocarLlave(llave: string | null, deps?: DepsConexion): Promise<void> {
  if (typeof llave !== "string" || !FORMA_LLAVE.test(llave)) return;
  const db = await base(deps);
  await db.clfAppConnection.updateMany({
    where: { keyHash: hashSecreto(llave), revokedAt: null },
    data: { revokedAt: ahoraDe(deps) },
  });
}

export type ConexionActiva = { id: string; appKey: string; externalLabel: string; createdAt: Date; lastUsedAt: Date | null };

/** Conexiones activas del usuario, para «Apps conectadas». */
export async function listarConexiones(userId: number, deps?: DepsConexion): Promise<ConexionActiva[]> {
  const db = await base(deps);
  return (await db.clfAppConnection.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, appKey: true, externalLabel: true, createdAt: true, lastUsedAt: true },
  })) as ConexionActiva[];
}

/** Revoca una conexión sólo si es del usuario. Devuelve true si revocó algo. */
export async function revocarConexionDelUsuario(userId: number, conexionId: string, deps?: DepsConexion): Promise<boolean> {
  if (typeof conexionId !== "string" || !conexionId || conexionId.length > 64) return false;
  const db = await base(deps);
  const r = await db.clfAppConnection.updateMany({
    where: { id: conexionId, userId, revokedAt: null },
    data: { revokedAt: ahoraDe(deps) },
  });
  return r.count > 0;
}
