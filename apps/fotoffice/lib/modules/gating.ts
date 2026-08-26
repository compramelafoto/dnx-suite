import { prisma } from "@repo/db";
import { isMissingCoursesSalesSchemaError } from "@/lib/courses-sales/prisma-errors";
import { listAvailableModuleKeys } from "./registry";

/**
 * Motor genérico de feature-flag por workspace.
 *
 * Fuente de verdad: `WorkspaceFeatureModule` (workspaceId + moduleKey + enabled).
 * No conoce ni consulta el registry de módulos (`./registry.ts`) para decidir el
 * resultado — el registry describe qué módulos EXISTEN, esto describe cuáles
 * están HABILITADOS para un workspace puntual. Son capas separadas a propósito.
 *
 * Nota de diseño: `@repo/auth-guards` ya expone un `requireWorkspaceModule`
 * genérico, pero resuelve el "workspace activo" con su propio mecanismo
 * (cookies multi-app, slug). `apps/fotoffice` ya tiene su propia resolución
 * de workspace activo en `lib/workspace.ts` (`resolveActiveWorkspace`, con
 * fallback a `Membership` legacy y caso especial de branding). Para no
 * alterar el comportamiento funcional existente de courses-sales/evaluaciones,
 * este módulo se mantiene agnóstico de esa resolución: recibe `workspaceId`
 * ya resuelto, y `lib/workspace.ts` es quien orquesta auth + workspace activo
 * + este gating.
 */
export async function isModuleEnabledForWorkspace(
  workspaceId: string,
  moduleKey: string,
): Promise<boolean> {
  try {
    const row = await prisma.workspaceFeatureModule.findUnique({
      where: {
        workspaceId_moduleKey: { workspaceId, moduleKey },
      },
    });
    return row?.enabled === true;
  } catch (e) {
    if (isMissingCoursesSalesSchemaError(e)) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[fotoffice] Tablas de módulos ausentes (moduleKey="${moduleKey}"). Ejecutá la migración SQL de feature modules o \`prisma migrate deploy\` en una BD alineada con el historial de migraciones.`,
        );
      }
      return false;
    }
    throw e;
  }
}

/**
 * Set de module keys AVAILABLE (registry) habilitadas para este workspace,
 * en una sola consulta — pensado para el sidebar, que hoy necesitaría N
 * llamadas a `isModuleEnabledForWorkspace` (una por módulo real).
 *
 * Nunca puede devolver una key con status "PLANNED": el filtro solo
 * considera las keys que `listAvailableModuleKeys()` devuelve.
 */
export async function getEnabledModuleKeysForWorkspace(workspaceId: string): Promise<Set<string>> {
  const availableKeys = listAvailableModuleKeys();
  if (availableKeys.length === 0) return new Set();
  try {
    const rows = await prisma.workspaceFeatureModule.findMany({
      where: { workspaceId, moduleKey: { in: availableKeys }, enabled: true },
      select: { moduleKey: true },
    });
    return new Set(rows.map((r) => r.moduleKey));
  } catch (e) {
    if (isMissingCoursesSalesSchemaError(e)) return new Set();
    throw e;
  }
}
