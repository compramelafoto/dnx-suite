/**
 * Quién puede diseñar las plantillas de la institución.
 *
 * Existe como función y no como una lista suelta en cada pantalla por lo que pasó: los cuatro
 * puntos de control del diseñador comparaban contra `"OWNER"` y `"ADMIN"`, pero
 * `WorkspaceMembership.role` guarda `WORKSPACE_OWNER`, `WORKSPACE_ADMIN` o `STAFF`. Ninguno
 * de los tres coincidía nunca, así que el control no filtraba a STAFF: rechazaba a todos,
 * incluido el dueño de la institución, y el diseñador quedó inalcanzable sin que ninguna
 * prueba lo notara.
 *
 * Diseñar la identidad visual es atribución de quien gobierna la institución. STAFF
 * administra el día a día y no entra acá.
 *
 * `ADMIN` se acepta por el mismo motivo que en `canManageMembers` y
 * `canManageWorkspaceSettings`: es el valor de la tabla de membresías vieja, y los tres
 * predicados tienen que decir lo mismo.
 */
export function canDesignTemplates(role: string | null | undefined): boolean {
  return role === "WORKSPACE_OWNER" || role === "WORKSPACE_ADMIN" || role === "ADMIN";
}
