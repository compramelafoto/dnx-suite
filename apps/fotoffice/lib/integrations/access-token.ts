import "server-only";
import { sanitizeError } from "@/lib/payments/connect/log";
import { getIntegrationDefinition } from "./registry";
import { GoogleIntegrationError, refreshIntegrationAccessToken } from "./google-oauth";
import { markIntegrationNeedsReconsent, readRefreshToken, touchIntegrationUsed } from "./store";
import { readIntegrationsGoogleCredentials } from "./credentials";

/**
 * Lo único que un módulo consumidor necesita saber de las integraciones.
 *
 * El access token de Google dura una hora, así que se pide uno nuevo en el momento de
 * usarlo y no se persiste: guardar algo que vence en una hora obliga a manejar su
 * vencimiento, y no hay nada que ganar a cambio.
 *
 * **Nunca lanza.** Un módulo que no puede espejar en el calendario tiene que seguir
 * funcionando: una falla de Google no puede impedir una reserva. Por eso el resultado es
 * un valor con su motivo, no una excepción.
 */

export type AccessTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: "NOT_CONNECTED" | "NEEDS_RECONSENT" | "CONFIG" | "UNAVAILABLE" };

export async function getGoogleAccessToken(
  workspaceId: string,
  integrationKey: string,
): Promise<AccessTokenResult> {
  const definition = getIntegrationDefinition(integrationKey);
  if (!definition || definition.status !== "AVAILABLE") {
    return { ok: false, reason: "NOT_CONNECTED" };
  }

  const refreshToken = await readRefreshToken(workspaceId, integrationKey).catch(() => null);
  if (!refreshToken) return { ok: false, reason: "NOT_CONNECTED" };

  const credenciales = readIntegrationsGoogleCredentials();
  if (!credenciales) return { ok: false, reason: "CONFIG" };

  try {
    const result = await refreshIntegrationAccessToken({
      refreshToken,
      clientId: credenciales.clientId,
      clientSecret: credenciales.clientSecret,
    });
    await touchIntegrationUsed(workspaceId, integrationKey).catch(() => undefined);
    return { ok: true, accessToken: result.accessToken };
  } catch (error) {
    // Distinguir "el permiso ya no vale" de "Google no contesta" es la decisión importante
    // de este archivo: la primera necesita que una persona reconecte; la segunda se arregla
    // sola y marcarla asustaría al dueño sin motivo.
    if (error instanceof GoogleIntegrationError && error.code === "INVALID_GRANT") {
      await markIntegrationNeedsReconsent(workspaceId, integrationKey).catch(() => undefined);
      return { ok: false, reason: "NEEDS_RECONSENT" };
    }
    console.error("[fotoffice][integraciones] no se pudo renovar el token", {
      workspaceId,
      integrationKey,
      detalle: sanitizeError(error),
    });
    return { ok: false, reason: "UNAVAILABLE" };
  }
}
