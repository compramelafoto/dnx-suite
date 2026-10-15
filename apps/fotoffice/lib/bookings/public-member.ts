import "server-only";
import { getAuthUser, type AuthUser } from "@/lib/auth";
import { listUserProfiles } from "@/lib/portal/profiles";

/**
 * ¿Quien mira la página pública de reservas es socio de esta institución?
 *
 * La página pública es la del no socio: tarifa plena y sin horas bonificadas. Un socio que
 * llega con la sesión iniciada —desde el menú del sitio, un enlace del blog o un buscador— no
 * tiene que ver ese precio: se lo manda a su portal, al mismo espacio y semana.
 *
 * Sólo funciona en el dominio de FOTOFFICE, que es donde vive la cookie de sesión. Por eso en
 * el dominio propio la sección de reservas se abre allá (ver `lib/website/domain/routing.ts`).
 */
export async function loadPublicBookingViewer(
  workspaceId: string,
): Promise<{ user: AuthUser | null; isMemberHere: boolean }> {
  const user = await getAuthUser();
  if (!user) return { user: null, isMemberHere: false };
  const perfiles = await listUserProfiles(user.id);
  return {
    user,
    isMemberHere: perfiles.some((p) => p.kind === "MEMBER" && p.workspaceId === workspaceId),
  };
}
