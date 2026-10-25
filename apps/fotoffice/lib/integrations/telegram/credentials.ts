import "server-only";
import { TELEGRAM_INTEGRATION_KEY } from "../registry";
import { deleteIntegration, getIntegrationSummary, readRefreshToken, saveIntegration } from "../store";

/**
 * Token del bot de Telegram de una institución (el que da @BotFather), guardado cifrado en
 * `WorkspaceIntegration` con el mismo baúl que WhatsApp y Google. El token no vuelve nunca al
 * navegador: la pantalla sólo puede saber SI hay uno.
 */

const PROVIDER = "TELEGRAM";

/** Guarda (o reemplaza) el token. Sin clave maestra lanza `IntegrationsVaultError` antes de escribir. */
export async function guardarTokenTelegram(workspaceId: string, token: string, botUsername: string, userId: number | null = null): Promise<void> {
  const limpio = token.trim();
  if (!limpio) throw new Error("Falta el token de Telegram.");
  await saveIntegration({
    workspaceId,
    integrationKey: TELEGRAM_INTEGRATION_KEY,
    provider: PROVIDER,
    accountEmail: `@${botUsername}`,
    accountExternalId: workspaceId,
    grantedScopes: [],
    refreshToken: limpio,
    connectedByUserId: userId,
  });
}

/** El token en claro, o `null` si no hay uno usable. Nunca lanza. */
export async function leerTokenTelegram(workspaceId: string): Promise<string | null> {
  const resumen = await getIntegrationSummary(workspaceId, TELEGRAM_INTEGRATION_KEY).catch(() => null);
  if (!resumen || resumen.status !== "ACTIVE") return null;
  const token = await readRefreshToken(workspaceId, TELEGRAM_INTEGRATION_KEY).catch(() => null);
  return token || null;
}

export async function hayTokenTelegram(workspaceId: string): Promise<boolean> {
  const resumen = await getIntegrationSummary(workspaceId, TELEGRAM_INTEGRATION_KEY).catch(() => null);
  return resumen?.status === "ACTIVE";
}

export async function borrarTokenTelegram(workspaceId: string): Promise<void> {
  await deleteIntegration(workspaceId, TELEGRAM_INTEGRATION_KEY);
}
