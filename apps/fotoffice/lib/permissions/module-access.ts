import "server-only";
import { cache } from "react";
import { Prisma, prisma } from "@repo/db";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";
import { listAvailableModuleKeys } from "@/lib/modules/registry";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import {
  hasLevel,
  isModuleEffectivelyEnabled,
  resolveModuleLevel,
  type ModuleLevel,
  type ModuleLevels,
  type RoleAssignmentForLevels,
} from "./levels";

/**
 * La única puerta para saber qué puede hacer alguien en un módulo (diseño de roles, §9).
 *
 * Páginas, acciones y menú preguntan acá. Si cada uno resolviera por su cuenta volvería a
 * pasar lo de antes de `resolveWorkspaceRole`: el menú ofrecía pantallas que la página negaba.
 */

async function loadAssignments(userId: number, workspaceId: string): Promise<RoleAssignmentForLevels[]> {
  try {
    const rows = await prisma.workspaceRoleAssignment.findMany({
      // `role.workspaceId` además del de la asignación: un rol de otra institución nunca cuenta.
      // Sin filtrar revocadas: la regla necesita saber si la persona tuvo roles (§12.3).
      // Por usuario directo o por su ficha de socio en ESTE workspace: un socio que recibió el
      // rol antes de tener cuenta lo hereda al vincularla (§12.1.4).
      where: {
        workspaceId,
        role: { workspaceId },
        OR: [{ userId }, { member: { userId, workspaceId } }],
      },
      select: {
        startsAt: true,
        endsAt: true,
        revokedAt: true,
        role: { select: { permissions: { select: { moduleKey: true, level: true } } } },
      },
    });
    return rows.map((r) => ({
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      revokedAt: r.revokedAt,
      permissions: r.role.permissions,
    }));
  } catch (e) {
    // P2021: la tabla no existe. Pasa en una base donde todavía no se aplicó la migración;
    // sin asignaciones, todos siguen con la compatibilidad, que es lo que tenían.
    // P2022: falta una columna. Pasa en una base con el SQL de la etapa 1 pero no el de la
    // etapa 2 (`memberId`, que usa la relación `member`): sin esto, toda página con guarda
    // daría error 500, incluso al dueño. Mismo criterio: compatibilidad hasta aplicar el SQL.
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      (e.code === "P2021" || e.code === "P2022")
    ) {
      return [];
    }
    throw e;
  }
}

/**
 * Varios guardas de una misma pantalla (shell, layout, página) preguntan lo mismo. `cache` de
 * React junta las tres consultas por (usuario, institución) dentro de un mismo render; fuera de
 * un render no memoiza. No lleva `now`: sólo se cachean datos, el reloj se aplica después.
 */
const loadLevelInputs = cache(async (userId: number, workspaceId: string) => {
  const [enabled, workspaceRole, assignments] = await Promise.all([
    getEnabledModuleKeysForWorkspace(workspaceId),
    resolveWorkspaceRole(userId, workspaceId),
    loadAssignments(userId, workspaceId),
  ]);
  return { enabled, workspaceRole, assignments };
});

export async function getModuleLevels(
  userId: number,
  workspaceId: string,
  now: Date = new Date(),
): Promise<ModuleLevels> {
  const { enabled, workspaceRole, assignments } = await loadLevelInputs(userId, workspaceId);

  const levels: Record<string, ModuleLevel> = {};
  for (const moduleKey of listAvailableModuleKeys()) {
    levels[moduleKey] = resolveModuleLevel({
      moduleKey,
      moduleEnabled: isModuleEffectivelyEnabled(moduleKey, enabled),
      workspaceRole,
      assignments,
      now,
    });
  }
  return levels;
}

export async function getModuleLevel(
  userId: number,
  workspaceId: string,
  moduleKey: string,
): Promise<ModuleLevel> {
  return (await getModuleLevels(userId, workspaceId))[moduleKey] ?? "NONE";
}

export async function hasModuleLevel(
  userId: number,
  workspaceId: string,
  moduleKey: string,
  required: "VIEW" | "MANAGE",
): Promise<boolean> {
  return hasLevel(await getModuleLevel(userId, workspaceId, moduleKey), required);
}
