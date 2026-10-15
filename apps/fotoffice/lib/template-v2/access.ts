import "server-only";
import { hasModuleLevel } from "@/lib/permissions/module-access";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { COMMUNICATIONS_MODULE_KEY } from "@/lib/communications/constants";

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

/**
 * Quién puede diseñar las placas de Comunicación: quien gestiona Comunicación.
 *
 * Es otra persona que la del carnet a propósito: quien lleva las redes de la institución no
 * tiene por qué poder tocar la credencial de identificación, y al revés.
 */
export async function canDesignPlacas(userId: number, workspaceId: string): Promise<boolean> {
  return hasModuleLevel(userId, workspaceId, COMMUNICATIONS_MODULE_KEY, "MANAGE");
}
