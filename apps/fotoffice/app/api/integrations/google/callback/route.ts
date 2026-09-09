import { NextResponse } from "next/server";
import { sanitizeError } from "@/lib/payments/connect/log";
import {
  INTEGRATIONS_GOOGLE_CALLBACK_PATH,
  exchangeIntegrationCode,
  fetchGoogleAccountEmail,
  hasAllScopes,
} from "@/lib/integrations/google-oauth";
import { consumeOAuthState } from "@/lib/integrations/oauth-state";
import { getIntegrationDefinition } from "@/lib/integrations/registry";
import { saveIntegration } from "@/lib/integrations/store";
import { readIntegrationsGoogleCredentials } from "@/lib/integrations/credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PANTALLA = "/workspace/configuracion/integraciones";

/**
 * Recibe el código de Google y guarda la credencial cifrada.
 *
 * Ningún camino de este archivo escribe el `code`, el `state` ni ningún token: ni en un
 * log, ni en la URL de vuelta, ni en un mensaje de error visible.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const volver = (params: string) => NextResponse.redirect(`${origin}${PANTALLA}?${params}`);

  // El usuario apretó "Cancelar" en la pantalla de Google. No es un error del sistema.
  if (url.searchParams.get("error")) return volver("error=cancelado");

  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!state || !code) return volver("error=respuesta_incompleta");

  const transito = await consumeOAuthState(state);
  if (!transito) return volver("error=estado_vencido");

  const definition = getIntegrationDefinition(transito.integrationKey);
  if (!definition || definition.status !== "AVAILABLE") {
    return volver("error=integracion_desconocida");
  }

  const credenciales = readIntegrationsGoogleCredentials();
  if (!credenciales) return volver("error=falta_configuracion");

  try {
    const token = await exchangeIntegrationCode({
      code,
      clientId: credenciales.clientId,
      clientSecret: credenciales.clientSecret,
      redirectUri: `${origin}${INTEGRATIONS_GOOGLE_CALLBACK_PATH}`,
    });

    // Google puede otorgar menos permisos de los pedidos. Guardar una integración que no
    // puede hacer su trabajo sería peor que no guardarla: se vería conectada y fallaría después.
    if (!hasAllScopes(token.grantedScopes, definition.scopes)) {
      return volver("error=permisos_incompletos");
    }

    const cuenta = await fetchGoogleAccountEmail(token.accessToken);

    await saveIntegration({
      workspaceId: transito.workspaceId,
      integrationKey: definition.key,
      provider: definition.provider,
      accountEmail: cuenta.email,
      accountExternalId: cuenta.externalId,
      grantedScopes: token.grantedScopes,
      refreshToken: token.refreshToken as string,
      connectedByUserId: transito.userId,
    });

    return volver(`ok=conectado&integracion=${encodeURIComponent(definition.key)}`);
  } catch (error) {
    console.error("[fotoffice][integraciones] falló la conexión con Google", {
      workspaceId: transito.workspaceId,
      integrationKey: transito.integrationKey,
      detalle: sanitizeError(error),
    });
    return volver("error=no_se_pudo_conectar");
  }
}
