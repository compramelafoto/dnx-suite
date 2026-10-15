import { cookies } from "next/headers";
import { FOTOFFICE_WORKSPACE_COOKIE } from "@/lib/courses-sales/constants";

const WORKSPACE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Fija la institución activa del panel de Administración.
 *
 * Sólo se puede llamar desde una Server Function o un Route Handler (Next no permite escribir
 * cookies durante el render). Quien la llama es responsable de haber verificado antes que la
 * persona pertenece a esa institución: esto no autoriza nada, sólo recuerda cuál está abierta.
 */
export async function setActiveWorkspaceCookie(workspaceId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(FOTOFFICE_WORKSPACE_COOKIE, workspaceId, {
    path: "/",
    maxAge: WORKSPACE_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}
