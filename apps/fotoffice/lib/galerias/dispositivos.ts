import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@repo/db";
import { MENSAJES_GALERIA as M, puedeConfigurarGalerias, type CtxGalerias } from "./acceso";

/**
 * Dispositivos de Galería (etapa 7, Entrega B): las claves con las que DNX FLUX publica las entregas.
 * Formato `fo_dev_<43 caracteres base64url>` (32 bytes al azar). En la base sólo vive el hash SHA-256
 * (hex) y los primeros 8 caracteres del secreto, para reconocerla en la lista. La clave completa se
 * muestra una sola vez, al crearla. Crear y anular exigen `configurar` (dueño o administrador).
 */

export const PREFIJO_CLAVE_DISPOSITIVO = "fo_dev_";
export const MAX_DISPOSITIVOS_ACTIVOS = 10;
export const MAX_NOMBRE_DISPOSITIVO = 60;
/** El último uso se actualiza como mucho cada 5 minutos. */
export const MS_ULTIMO_USO = 5 * 60 * 1000;

const FORMATO_CLAVE = /^fo_dev_[A-Za-z0-9_-]{43}$/;

export const MENSAJES_DISPOSITIVO = {
  nombre: `Ponele un nombre al dispositivo (hasta ${MAX_NOMBRE_DISPOSITIVO} caracteres).`,
  tope: `Ya hay ${MAX_DISPOSITIVOS_ACTIVOS} dispositivos activos. Anulá alguno para conectar otro.`,
  noExiste: "No encontramos ese dispositivo.",
  yaAnulado: "Ese dispositivo ya estaba anulado.",
  guardar: "No se pudo guardar el cambio.",
} as const;

export function hashDeClave(clave: string): string {
  return createHash("sha256").update(clave, "utf8").digest("hex");
}

export function generarClaveDispositivo(): { clave: string; hash: string; prefijo: string } {
  const secreto = randomBytes(32).toString("base64url");
  const clave = `${PREFIJO_CLAVE_DISPOSITIVO}${secreto}`;
  return { clave, hash: hashDeClave(clave), prefijo: secreto.slice(0, 8) };
}

export type DispositivoVisible = {
  id: string;
  nombre: string;
  prefijo: string;
  creado: string;
  ultimoUso: string | null;
  anulado: boolean;
};

export type CtxDispositivo = { workspaceId: string; deviceId: string };

/** Lee `Authorization: Bearer fo_dev_…` y devuelve el dispositivo vigente, o null (sin decir por qué). */
export async function autenticarDispositivo(authorization: string | null, ahora: Date = new Date()): Promise<CtxDispositivo | null> {
  if (!authorization) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  if (!m || !FORMATO_CLAVE.test(m[1])) return null;
  const fila = await prisma.fotofficeDispositivo.findUnique({
    where: { keyHash: hashDeClave(m[1]) },
    select: { id: true, workspaceId: true, revokedAt: true },
  });
  if (!fila || fila.revokedAt !== null) return null;
  // Escritura condicional: sólo si nunca se usó o pasaron 5 minutos. No frena ni rompe el pedido.
  void prisma.fotofficeDispositivo
    .updateMany({
      where: { id: fila.id, revokedAt: null, OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: new Date(ahora.getTime() - MS_ULTIMO_USO) } }] },
      data: { lastUsedAt: ahora },
    })
    .catch(() => undefined);
  return { workspaceId: fila.workspaceId, deviceId: fila.id };
}

export async function listarDispositivos(ctx: CtxGalerias): Promise<DispositivoVisible[]> {
  if (!puedeConfigurarGalerias(ctx)) return [];
  const filas = await prisma.fotofficeDispositivo.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
    select: { id: true, name: true, keyPrefix: true, createdAt: true, lastUsedAt: true, revokedAt: true },
  });
  return filas.map((f) => ({
    id: f.id,
    nombre: f.name,
    prefijo: f.keyPrefix,
    creado: f.createdAt.toISOString(),
    ultimoUso: f.lastUsedAt ? f.lastUsedAt.toISOString() : null,
    anulado: f.revokedAt !== null,
  }));
}

export type ResultadoCrearDispositivo = { ok: true; id: string; clave: string; prefijo: string } | { ok: false; error: string };

/** Conecta un dispositivo y devuelve la clave completa (única vez). Tope: 10 activos por organización. */
export async function crearDispositivo(ctx: CtxGalerias, nombre: unknown): Promise<ResultadoCrearDispositivo> {
  if (!puedeConfigurarGalerias(ctx)) return { ok: false, error: M.sinPermiso };
  const n = typeof nombre === "string" ? nombre.replace(/\s+/g, " ").trim() : "";
  if (n.length < 1 || n.length > MAX_NOMBRE_DISPOSITIVO) return { ok: false, error: MENSAJES_DISPOSITIVO.nombre };
  const activos = await prisma.fotofficeDispositivo.count({ where: { workspaceId: ctx.workspaceId, revokedAt: null } });
  if (activos >= MAX_DISPOSITIVOS_ACTIVOS) return { ok: false, error: MENSAJES_DISPOSITIVO.tope };
  const k = generarClaveDispositivo();
  try {
    const fila = await prisma.fotofficeDispositivo.create({
      data: { workspaceId: ctx.workspaceId, name: n, keyHash: k.hash, keyPrefix: k.prefijo, createdByUserId: ctx.userId },
      select: { id: true },
    });
    return { ok: true, id: fila.id, clave: k.clave, prefijo: k.prefijo };
  } catch {
    return { ok: false, error: MENSAJES_DISPOSITIVO.guardar };
  }
}

/** Anula la clave (deja de servir en el acto). Acotado a la organización del contexto. */
export async function anularDispositivo(ctx: CtxGalerias, id: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!puedeConfigurarGalerias(ctx)) return { ok: false, error: M.sinPermiso };
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return { ok: false, error: MENSAJES_DISPOSITIVO.noExiste };
  const r = await prisma.fotofficeDispositivo.updateMany({ where: { id, workspaceId: ctx.workspaceId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (r.count === 1) return { ok: true };
  const existe = await prisma.fotofficeDispositivo.count({ where: { id, workspaceId: ctx.workspaceId } });
  return { ok: false, error: existe > 0 ? MENSAJES_DISPOSITIVO.yaAnulado : MENSAJES_DISPOSITIVO.noExiste };
}
