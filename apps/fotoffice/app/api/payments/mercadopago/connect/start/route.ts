import { NextResponse } from "next/server";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canManageWorkspaceCollection } from "@/lib/payments/connect/authz";
import { createConnectDeps } from "@/lib/payments/connect/deps";
import { ConnectError, startMpConnection } from "@/lib/payments/connect/service";
import { sanitizeError } from "@/lib/payments/connect/log";

export const dynamic = "force-dynamic";

const SETTINGS_URL = "/workspace/configuracion/cobros";

/**
 * Inicia la vinculación de la cuenta de MercadoPago de la institución.
 *
 * Redirige a MercadoPago para que la institución autorice. El estado OAuth queda guardado
 * del lado del servidor —solo su hash— y el verificador PKCE cifrado.
 */
export async function GET(request: Request) {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) {
    return NextResponse.redirect(new URL("/workspace", request.url));
  }

  if (!(await canManageWorkspaceCollection(user.id, workspace.id))) {
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?error=sin_permiso`, request.url),
    );
  }

  try {
    const { authorizeUrl } = await startMpConnection(
      { workspaceId: workspace.id, userId: user.id, legalName: workspace.name },
      createConnectDeps(),
    );
    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    // Nunca se propaga el detalle al navegador: puede contener nombres de variables de
    // entorno o mensajes del proveedor.
    const code = error instanceof ConnectError ? error.code : "ERROR";
    console.error("[fotoffice][mp-connect] start falló", {
      code,
      detalle: sanitizeError(error),
    });
    return NextResponse.redirect(new URL(`${SETTINGS_URL}?error=${code}`, request.url));
  }
}
