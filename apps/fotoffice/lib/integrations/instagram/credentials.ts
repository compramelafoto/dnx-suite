import "server-only";
import { INSTAGRAM_INTEGRATION_KEY } from "../registry";
import { deleteIntegration, getIntegrationSummary, readRefreshToken, saveIntegration } from "../store";

/**
 * Token de la página de Facebook vinculada a la cuenta de Instagram de una institución (para leer
 * perfiles y contestar mensajes directos), guardado cifrado en `WorkspaceIntegration` con el mismo
 * baúl que WhatsApp y pasando por `lib/integrations/store.ts`. El token no vuelve nunca al
 * navegador: la pantalla sólo puede saber SI hay uno (`hayTokenInstagram`).
 */

const PROVIDER = "INSTAGRAM";

/** Guarda (o reemplaza) el token. Sin clave maestra lanza `IntegrationsVaultError` antes de escribir. */
export async function guardarTokenInstagram(workspaceId: string, token: string, userId: number | null = null): Promise<void> {
  const limpio = token.trim();
  if (!limpio) throw new Error("Falta el token de Instagram.");
  await saveIntegration({
    workspaceId,
    integrationKey: INSTAGRAM_INTEGRATION_KEY,
    provider: PROVIDER,
    accountEmail: "instagram-business",
    accountExternalId: workspaceId,
    grantedScopes: [],
    refreshToken: limpio,
    connectedByUserId: userId,
  });
}

/**
 * El token en claro, o `null` si no hay uno usable (no cargado, revocado o imposible de descifrar).
 * Nunca lanza.
 */
export async function leerTokenInstagram(workspaceId: string): Promise<string | null> {
  const resumen = await getIntegrationSummary(workspaceId, INSTAGRAM_INTEGRATION_KEY).catch(() => null);
  if (!resumen || resumen.status !== "ACTIVE") return null;
  const token = await readRefreshToken(workspaceId, INSTAGRAM_INTEGRATION_KEY).catch(() => null);
  return token || null;
}

/** ¿Hay un token cargado y activo? No descifra nada. */
export async function hayTokenInstagram(workspaceId: string): Promise<boolean> {
  const resumen = await getIntegrationSummary(workspaceId, INSTAGRAM_INTEGRATION_KEY).catch(() => null);
  return resumen?.status === "ACTIVE";
}

export async function borrarTokenInstagram(workspaceId: string): Promise<void> {
  await deleteIntegration(workspaceId, INSTAGRAM_INTEGRATION_KEY);
}
