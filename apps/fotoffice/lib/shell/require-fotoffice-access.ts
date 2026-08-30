import { redirect } from "next/navigation";
import { hasAppAccess, requireAuth } from "@/lib/auth";
import { resolveFotofficeUserKind } from "@/lib/portal/user-kind";
import { PORTAL_HOME } from "@/lib/portal/destination";

/**
 * Quién puede entrar al panel de FotOffice.
 *
 * Vive acá y no dentro del layout del panel porque el editor de plantillas se abre fuera de
 * ese layout —ocupa la ventana entera, sin menú— y tiene que exigir exactamente lo mismo. Dos
 * copias de esta comprobación es como se abre un agujero: alcanza con que una se actualice.
 */
export async function requireFotofficePanelUser() {
  const user = await requireAuth();
  if (!hasAppAccess(user, "FOTOFFICE")) {
    redirect("/login?forbiddenApp=fotoffice");
  }
  // Un socio no entra al panel administrativo: su lugar es el portal.
  if ((await resolveFotofficeUserKind(user.id)) === "MEMBER") redirect(PORTAL_HOME);
  return user;
}
