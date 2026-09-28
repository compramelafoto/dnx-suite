import "server-only";
import { prisma } from "@repo/db";
import {
  deleteIntegration,
  getIntegrationSummary,
  markIntegrationNeedsReconsent,
  readIntegrationSecret,
  saveSecretIntegration,
  type IntegrationStatusValue,
} from "@/lib/integrations/store";
import { ALBOOM_INTEGRATION_KEY, ALBOOM_PROVIDER } from "../constants";
import type { CredencialAlboom } from "./client";

/**
 * Única puerta a la credencial de Alboom.
 *
 * Mismo cofre que Google (`WorkspaceIntegration`), pero acá el secreto no es un refresh
 * token: es la credencial completa (subdominio, usuario y contraseña) serializada como
 * JSON, porque la API interna de Alboom no tiene OAuth. La contraseña sale en claro sólo
 * por `leerCredencialAlboom`.
 */
export async function guardarCredencialAlboom(
  workspaceId: string,
  cred: CredencialAlboom,
  userId: number | null,
): Promise<void> {
  await saveSecretIntegration({
    workspaceId,
    integrationKey: ALBOOM_INTEGRATION_KEY,
    provider: ALBOOM_PROVIDER,
    accountEmail: cred.username,
    accountExternalId: cred.subdomain,
    secret: JSON.stringify(cred),
    connectedByUserId: userId,
  });
}

export async function leerCredencialAlboom(workspaceId: string): Promise<CredencialAlboom | null> {
  const crudo = await readIntegrationSecret(workspaceId, ALBOOM_INTEGRATION_KEY);
  if (!crudo) return null;
  const c = JSON.parse(crudo) as Partial<CredencialAlboom>;
  if (!c.subdomain || !c.username || !c.password) return null;
  return { subdomain: c.subdomain, username: c.username, password: c.password };
}

export async function borrarCredencialAlboom(workspaceId: string): Promise<void> {
  await deleteIntegration(workspaceId, ALBOOM_INTEGRATION_KEY);
}

/** Alboom rechazó el usuario o la contraseña. Igual que Google: no se borra la fila. */
export async function marcarCredencialRechazada(workspaceId: string): Promise<void> {
  await markIntegrationNeedsReconsent(workspaceId, ALBOOM_INTEGRATION_KEY);
}

export async function resumenConexionAlboom(workspaceId: string): Promise<{
  usuario: string;
  subdomain: string | null;
  estado: IntegrationStatusValue;
  conectadaEn: Date;
} | null> {
  const r = await getIntegrationSummary(workspaceId, ALBOOM_INTEGRATION_KEY);
  if (!r) return null;
  const fila = await prisma.workspaceIntegration.findUnique({
    // aislamiento: clave compuesta workspaceId_integrationKey
    where: { workspaceId_integrationKey: { workspaceId, integrationKey: ALBOOM_INTEGRATION_KEY } },
    select: { accountExternalId: true },
  });
  return {
    usuario: r.accountEmail,
    subdomain: fila?.accountExternalId ?? null,
    estado: r.status,
    conectadaEn: r.connectedAt,
  };
}

/** Workspaces con la credencial activa. Para el cron. */
export async function workspacesConAlboomActivo(): Promise<string[]> {
  // aislamiento: recorre todos los workspaces a propósito; el cron trabaja uno por uno.
  const filas = await prisma.workspaceIntegration.findMany({
    where: { integrationKey: ALBOOM_INTEGRATION_KEY, status: "ACTIVE" },
    select: { workspaceId: true },
  });
  return filas.map((f) => f.workspaceId);
}
