import "server-only";
import { WHATSAPP_INTEGRATION_KEY } from "../registry";
import { deleteIntegration, getIntegrationSummary, readRefreshToken, saveIntegration } from "../store";

/**
 * Token de la API de WhatsApp Business (Meta) de una institución, guardado cifrado en
 * `WorkspaceIntegration` con el mismo baúl que Google y Correo Argentino y pasando por
 * `lib/integrations/store.ts`. El token no vuelve nunca al navegador: la pantalla sólo puede
 * saber SI hay uno (`hayTokenWhatsapp`).
 */

const PROVIDER = "WHATSAPP";

/** Guarda (o reemplaza) el token. Sin clave maestra lanza `IntegrationsVaultError` antes de escribir. */
export async function guardarTokenWhatsapp(workspaceId: string, token: string, userId: number | null = null): Promise<void> {
  const limpio = token.trim();
  if (!limpio) throw new Error("Falta el token de WhatsApp.");
  await saveIntegration({
    workspaceId,
    integrationKey: WHATSAPP_INTEGRATION_KEY,
    provider: PROVIDER,
    accountEmail: "whatsapp-business",
    accountExternalId: workspaceId,
    grantedScopes: [],
    refreshToken: limpio,
    connectedByUserId: userId,
  });
}

/**
 * El token en claro, o `null` si no hay uno usable (no cargado, revocado o imposible de descifrar).
 * Nunca lanza: quien envía cae al modo simulado y no pierde el mensaje.
 */
export async function leerTokenWhatsapp(workspaceId: string): Promise<string | null> {
  const resumen = await getIntegrationSummary(workspaceId, WHATSAPP_INTEGRATION_KEY).catch(() => null);
  if (!resumen || resumen.status !== "ACTIVE") return null;
  const token = await readRefreshToken(workspaceId, WHATSAPP_INTEGRATION_KEY).catch(() => null);
  return token || null;
}

/** ¿Hay un token cargado y activo? No descifra nada. */
export async function hayTokenWhatsapp(workspaceId: string): Promise<boolean> {
  const resumen = await getIntegrationSummary(workspaceId, WHATSAPP_INTEGRATION_KEY).catch(() => null);
  return resumen?.status === "ACTIVE";
}

export async function borrarTokenWhatsapp(workspaceId: string): Promise<void> {
  await deleteIntegration(workspaceId, WHATSAPP_INTEGRATION_KEY);
}
