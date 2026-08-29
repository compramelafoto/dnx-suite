import { prisma } from "@repo/db";

/**
 * Rol del usuario en un workspace. **Fuente única de verdad: `WorkspaceMembership`.**
 *
 * Existe para que el menú lateral y las páginas no puedan discrepar. Antes cada uno
 * resolvía el rol por su cuenta: `(shell)/layout.tsx` aceptaba un respaldo a la tabla
 * legacy `Membership` cuando no había filas unificadas, y `requireMembersContext` no.
 * Resultado: el menú mostraba las pantallas de gestión y la página rebotaba a
 * `/members?forbidden=manage`.
 *
 * NO hay respaldo legacy acá, a propósito. Verificado contra la base: los únicos pares
 * (usuario, workspace) que existen solo en `Membership` son semillas de FotoRank
 * (`admin@fotorank.local`, `admin@fotorank.com`, `organizador@`, `participante1/2@`)
 * en los workspaces de prueba "Workspace Demo", "Sociedad de Fotógrafos" y "DNX Estudio".
 * Ninguna de esas cuentas tiene acceso a FotOffice ni es un usuario real del panel.
 * Todos los usuarios reales —SFPR, DNX Owner, QA— tienen su fila en `WorkspaceMembership`.
 *
 * `WorkspaceRole` es el enum nuevo (`WORKSPACE_OWNER` | `WORKSPACE_ADMIN` | `STAFF`).
 * `canManageMembers` y `canManageWorkspaceSettings` siguen aceptando además el `ADMIN`
 * legacy porque otros callers —`app/actions/settings.ts`, `lib/carnet/operators.ts`,
 * `lib/payments/connect/authz.ts`— todavía les pasan roles de la tabla vieja.
 */
export async function resolveWorkspaceRole(
  userId: number,
  workspaceId: string,
): Promise<string | null> {
  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { role: true },
  });
  return membership?.role ?? null;
}
