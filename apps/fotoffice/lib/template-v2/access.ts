import "server-only";
import { hasModuleLevel } from "@/lib/permissions/module-access";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";

/**
 * Quién puede diseñar las plantillas de la institución: quien gestiona Socios (`members`
 * MANAGE, roles etapa 2b). Dueño y admin siempre; STAFF sin roles tiene VIEW y no entra, igual
 * que antes; con un rol, la comisión decide a quién se lo da.
 *
 * Existe como función, y no como una comprobación suelta en cada pantalla, por lo que pasó: los
 * cuatro puntos de control del diseñador comparaban contra `"OWNER"` y `"ADMIN"`, valores que
 * no existen en `WorkspaceMembership.role`. El control rechazaba a todos, incluido el dueño, y
 * el diseñador quedó inalcanzable sin que ninguna prueba lo notara.
 */
export async function canDesignTemplates(userId: number, workspaceId: string): Promise<boolean> {
  return hasModuleLevel(userId, workspaceId, MEMBERS_MODULE_KEY, "MANAGE");
}
