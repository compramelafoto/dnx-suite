import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import {
  INTEGRATIONS_GOOGLE_CALLBACK_PATH,
  buildIntegrationAuthorizationUrl,
} from "@/lib/integrations/google-oauth";
import { getIntegrationDefinition } from "@/lib/integrations/registry";
import { readIntegrationsGoogleCredentials } from "@/lib/integrations/credentials";
import { createOAuthState } from "@/lib/integrations/oauth-state";
import { getIntegrationSummary } from "@/lib/integrations/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PANTALLA = "/workspace/configuracion/integraciones";

function volverConError(origin: string, codigo: string) {
  return NextResponse.redirect(`${origin}${PANTALLA}?error=${codigo}`);
}

/**
 * Manda al dueño a darle permiso a Google.
 *
 * No es el login: pide acceso sin conexión para poder actuar en nombre de la institución
 * cuando nadie está mirando la pantalla. Ver `lib/integrations/google-oauth.ts`.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;

  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");

  const role = await resolveWorkspaceRole(user.id, workspace.id);
  if (!canManageWorkspaceSettings(role)) return volverConError(origin, "sin_permiso");

  const key = url.searchParams.get("integration")?.trim() ?? "";
  const definition = getIntegrationDefinition(key);
  if (!definition || definition.status !== "AVAILABLE") {
    return volverConError(origin, "integracion_desconocida");
  }

  const credenciales = readIntegrationsGoogleCredentials();
  if (!credenciales) return volverConError(origin, "falta_configuracion");

  const state = await createOAuthState({
    workspaceId: workspace.id,
    integrationKey: definition.key,
    userId: user.id,
    redirectPath: PANTALLA,
  });

  // Al reconectar, sugerirle la cuenta que ya había usado evita que conecte otra por error.
  const anterior = await getIntegrationSummary(workspace.id, definition.key);

  return NextResponse.redirect(
    buildIntegrationAuthorizationUrl({
      clientId: credenciales.clientId,
      redirectUri: `${origin}${INTEGRATIONS_GOOGLE_CALLBACK_PATH}`,
      state,
      scopes: definition.scopes,
      ...(anterior ? { loginHint: anterior.accountEmail } : {}),
    }),
  );
}
