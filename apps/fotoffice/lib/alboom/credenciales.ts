import "server-only";
import { prisma } from "@repo/db";
import { ALBOOM_INTEGRATION_KEY } from "@/lib/integrations/registry";
import {
  deleteIntegration,
  getIntegrationSummary,
  markIntegrationNeedsReconsent,
  readRefreshToken,
  saveIntegration,
  touchIntegrationUsed,
  type IntegrationStatusValue,
} from "@/lib/integrations/store";
import { requireIntegrationsMasterKey } from "@/lib/integrations/vault";
import { AlboomApiError, crearClienteAlboom, subdominioValido, type CredencialAlboom, type OpcionesCliente } from "./client";

/**
 * Única puerta a la credencial de Alboom. Mismo baúl que Google y los transportistas (`WorkspaceIntegration`,
 * vía `lib/integrations/store`): lo cifrado es `{ subdomain, username, password }`, porque la API interna de
 * Alboom no tiene OAuth.
 *
 * La contraseña sale en claro sólo por `leerCredencialAlboom`, y sólo la usa el extractor para iniciar sesión.
 * No se loguea, no se devuelve por HTTP y no vuelve al navegador: la pantalla usa `resumenConexionAlboom`
 * (usuario, subdominio, estado y fecha).
 */

const PROVIDER = "ALBOOM";

export type ConexionAlboom = {
  usuario: string;
  subdomain: string | null;
  estado: IntegrationStatusValue;
  conectadaEn: Date;
  ultimoUso: Date | null;
};

/** Limpia lo que escribe la persona: "https://dnxfotografia.alboomcrm.com/" → "dnxfotografia". */
export function normalizarSubdominio(valor: string): string {
  let v = valor.trim().toLowerCase();
  v = v.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  v = v.replace(/\.alboomcrm\.com$/, "");
  return v;
}

/**
 * Prueba el inicio de sesión contra Alboom y recién entonces guarda cifrado. Lanza `AlboomLoginError` si Alboom
 * rechaza el usuario o la contraseña, `AlboomApiError` si no se pudo hablar con Alboom o falta un dato, e
 * `IntegrationsVaultError` (antes de tocar la red) si no hay clave maestra.
 */
export async function conectarAlboom(
  workspaceId: string,
  userId: number,
  entrada: CredencialAlboom,
  opciones: OpcionesCliente = {},
): Promise<void> {
  const cred: CredencialAlboom = {
    subdomain: normalizarSubdominio(entrada.subdomain ?? ""),
    username: (entrada.username ?? "").trim(),
    password: entrada.password ?? "",
  };
  if (!subdominioValido(cred.subdomain) || !cred.username || !cred.password) {
    throw new AlboomApiError("Faltan datos para conectar Alboom");
  }
  // Sin dónde cifrar no tiene sentido ir a Alboom.
  requireIntegrationsMasterKey();
  await crearClienteAlboom(cred, opciones);
  await saveIntegration({
    workspaceId,
    integrationKey: ALBOOM_INTEGRATION_KEY,
    provider: PROVIDER,
    accountEmail: cred.username,
    accountExternalId: cred.subdomain,
    // No es OAuth: no hay permisos otorgados.
    grantedScopes: [],
    // `saveIntegration` cifra este campo; para Alboom es el JSON de la credencial.
    refreshToken: JSON.stringify(cred),
    connectedByUserId: userId,
  });
}

function parsear(texto: string): CredencialAlboom | null {
  try {
    const c = JSON.parse(texto) as Partial<CredencialAlboom>;
    if (typeof c.subdomain === "string" && typeof c.username === "string" && typeof c.password === "string" && c.subdomain && c.username && c.password) {
      return { subdomain: c.subdomain, username: c.username, password: c.password };
    }
  } catch {
    // cae al null
  }
  return null;
}

/**
 * La credencial en claro, sólo si la conexión está ACTIVA. `null` si no hay, si hay que volver a conectar o si
 * no se puede descifrar. Quien la recibe no la propaga.
 */
export async function leerCredencialAlboom(workspaceId: string): Promise<CredencialAlboom | null> {
  const resumen = await getIntegrationSummary(workspaceId, ALBOOM_INTEGRATION_KEY);
  if (!resumen || resumen.status !== "ACTIVE") return null;
  const texto = await readRefreshToken(workspaceId, ALBOOM_INTEGRATION_KEY).catch(() => null);
  return texto ? parsear(texto) : null;
}

export async function resumenConexionAlboom(workspaceId: string): Promise<ConexionAlboom | null> {
  const r = await getIntegrationSummary(workspaceId, ALBOOM_INTEGRATION_KEY);
  if (!r) return null;
  const fila = await prisma.workspaceIntegration.findUnique({
    // aislamiento: clave compuesta workspaceId_integrationKey
    where: { workspaceId_integrationKey: { workspaceId, integrationKey: ALBOOM_INTEGRATION_KEY } },
    select: { accountExternalId: true },
  });
  return { usuario: r.accountEmail, subdomain: fila?.accountExternalId ?? null, estado: r.status, conectadaEn: r.connectedAt, ultimoUso: r.lastUsedAt };
}

/** Alboom rechazó el usuario o la contraseña. No se borra la fila: la pantalla pide volver a conectar. */
export async function marcarAlboomParaReconectar(workspaceId: string): Promise<void> {
  await markIntegrationNeedsReconsent(workspaceId, ALBOOM_INTEGRATION_KEY).catch(() => undefined);
}

export async function marcarAlboomUsada(workspaceId: string): Promise<void> {
  await touchIntegrationUsed(workspaceId, ALBOOM_INTEGRATION_KEY).catch(() => undefined);
}

/** Borra la credencial. No hay nada que revocar del lado de Alboom. */
export async function borrarCredencialAlboom(workspaceId: string): Promise<void> {
  await deleteIntegration(workspaceId, ALBOOM_INTEGRATION_KEY);
}
