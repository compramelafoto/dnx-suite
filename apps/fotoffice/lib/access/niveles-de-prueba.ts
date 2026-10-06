import { listAvailableModuleKeys } from "@/lib/modules/registry";
import { resolveModuleLevel, type ModuleLevels } from "@/lib/permissions/levels";

/**
 * Sólo para pruebas: los niveles que `getModuleLevels` daría a un rol sin roles de la comisión y
 * con todos los módulos encendidos (dueño/admin: todo; STAFF: la compatibilidad; colaborador o
 * sin rol: nada). Usa la misma función pura que main.
 */
export function nivelesPorRol(role: string | null): ModuleLevels {
  const now = new Date();
  return Object.fromEntries(
    listAvailableModuleKeys().map((moduleKey) => [
      moduleKey,
      resolveModuleLevel({ moduleKey, moduleEnabled: true, workspaceRole: role, assignments: [], now }),
    ]),
  );
}
