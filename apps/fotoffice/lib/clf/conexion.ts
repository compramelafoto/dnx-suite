import "server-only";
import { prisma } from "@repo/db";
import { CLF_INTEGRATION_KEY } from "@/lib/integrations/registry";
import { deleteIntegration, readRefreshToken, saveIntegration } from "@/lib/integrations/store";
import { CLF_BASE_URL } from "./enlace";
import { revocarLlave, type CuentaClf, type DepsApiClf } from "./api";

/**
 * Conexión de un espacio de FOTOFFICE con una cuenta de CLF (etapa 2). La llave vive cifrada en
 * `WorkspaceIntegration` (`compramelafoto`); `FotofficeClfConexion` guarda el estado de la sincronización.
 * Sin permisos: quien llama ya validó que es dueño o admin del espacio.
 */

export const FOTOFFICE_BASE_URL_POR_OMISION = "https://fotoffice.com";
export const RUTA_CALLBACK_CLF = "/api/integraciones/clf/callback";

export type EstadoCuentas = "VERIFICADA" | "DISTINTAS" | "SIN_COBROS";

/** ¿La cuenta de Mercado Pago de CLF es la misma que la de Configuración → Cobros? */
export function estadoDeCuentas(clfMpUserId: string | null, providerUserId: string | null): EstadoCuentas {
  if (!providerUserId) return "SIN_COBROS";
  return clfMpUserId && clfMpUserId === providerUserId ? "VERIFICADA" : "DISTINTAS";
}

export function urlDeRetorno(env: Readonly<Record<string, string | undefined>> = process.env): string {
  return `${(env.FOTOFFICE_PUBLIC_BASE_URL?.trim() || FOTOFFICE_BASE_URL_POR_OMISION).replace(/\/+$/, "")}${RUTA_CALLBACK_CLF}`;
}

export function urlDeAutorizacion(
  state: string,
  espacio: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const base = (env.CLF_PUBLIC_BASE_URL?.trim() || CLF_BASE_URL).replace(/\/+$/, "");
  const q = new URLSearchParams({ state, espacio: espacio.slice(0, 80), vuelta: urlDeRetorno(env) });
  return `${base}/conectar/fotoffice?${q.toString()}`;
}

export async function guardarConexion(workspaceId: string, userId: number | null, datos: { llave: string; cuenta: CuentaClf }): Promise<void> {
  await saveIntegration({
    workspaceId,
    integrationKey: CLF_INTEGRATION_KEY,
    provider: "CLF",
    accountEmail: "",
    accountExternalId: String(datos.cuenta.id),
    grantedScopes: ["ventas:leer"],
    refreshToken: datos.llave,
    connectedByUserId: userId,
  });
  const comun = { clfCuentaNombre: datos.cuenta.nombre, clfMpUserId: datos.cuenta.mpUserId, ultimoError: null, cerradaEl: null };
  const previa = await prisma.fotofficeClfConexion.findUnique({ where: { workspaceId }, select: { clfUserId: true } });
  if (previa && previa.clfUserId !== datos.cuenta.id) {
    // Otra cuenta de CLF: el cursor de la anterior no sirve y sus ventas no son de esta cuenta. Se borran las copias
    // (son sólo una copia de CLF: si se vuelve a conectar la cuenta anterior, se traen de nuevo).
    await prisma.fotofficeClfVenta.deleteMany({ where: { workspaceId } });
    await prisma.fotofficeClfConexion.update({ where: { workspaceId }, data: { ...comun, clfUserId: datos.cuenta.id, cursor: null } });
  } else {
    await prisma.fotofficeClfConexion.upsert({
      where: { workspaceId },
      create: { workspaceId, clfUserId: datos.cuenta.id, ...comun },
      update: comun,
    });
  }
  await prisma.fotofficeClfVenta.updateMany({ where: { workspaceId }, data: { conexionCerrada: false } });
}

/** La llave en claro, sólo para hablar con CLF desde el servidor. Null si no hay conexión activa. */
export async function leerLlave(workspaceId: string): Promise<string | null> {
  const c = await prisma.fotofficeClfConexion.findUnique({ where: { workspaceId }, select: { cerradaEl: true } });
  if (!c || c.cerradaEl) return null;
  return readRefreshToken(workspaceId, CLF_INTEGRATION_KEY).catch(() => null);
}

/** Avisa a CLF (sin frenar si no responde), borra la llave y deja las ventas importadas marcadas «conexión cerrada». */
export async function desconectar(workspaceId: string, deps: DepsApiClf = {}): Promise<void> {
  const llave = await readRefreshToken(workspaceId, CLF_INTEGRATION_KEY).catch(() => null);
  if (llave) await revocarLlave(llave, deps);
  await deleteIntegration(workspaceId, CLF_INTEGRATION_KEY).catch(() => null);
  await prisma.fotofficeClfConexion.updateMany({ where: { workspaceId, cerradaEl: null }, data: { cerradaEl: new Date() } });
  await prisma.fotofficeClfVenta.updateMany({ where: { workspaceId }, data: { conexionCerrada: true } });
}

export type ResumenConexionClf = {
  cuenta: string;
  clfMpUserId: string | null;
  ultimaSincronizacionEl: Date | null;
  ultimoError: string | null;
  cerrada: boolean;
};

export async function resumenConexionClf(workspaceId: string): Promise<ResumenConexionClf | null> {
  const c = await prisma.fotofficeClfConexion.findUnique({ where: { workspaceId } });
  if (!c) return null;
  return {
    cuenta: c.clfCuentaNombre,
    clfMpUserId: c.clfMpUserId,
    ultimaSincronizacionEl: c.ultimaSincronizacionEl,
    ultimoError: c.ultimoError,
    cerrada: c.cerradaEl !== null,
  };
}
