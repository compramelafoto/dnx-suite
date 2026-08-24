import { prisma } from "@repo/db";
import { DEFAULT_PLATFORM_FEE_BPS, resolvePlatformFeeBps } from "./fee";

/**
 * Comisión efectiva de un módulo en un workspace.
 *
 * Punto único de resolución: ningún módulo consulta la tabla por su cuenta, para que no
 * puedan divergir los criterios de fallback.
 *
 * Si la base falla se devuelve el default en vez de propagar el error: el peor caso es
 * cobrar 5% en lugar de lo pactado; propagar sería romper el checkout entero.
 */
export async function getPlatformFeeBps(workspaceId: string, moduleKey: string): Promise<number> {
  try {
    const row = await prisma.workspaceModuleFee.findUnique({
      where: { workspaceId_moduleKey: { workspaceId, moduleKey } },
      select: { feeBps: true },
    });
    return resolvePlatformFeeBps(row?.feeBps);
  } catch {
    return DEFAULT_PLATFORM_FEE_BPS;
  }
}

/** Versión en lote para pantallas que listan varios módulos. Completa los faltantes con el default. */
export async function getPlatformFeeBpsByModule(
  workspaceId: string,
  moduleKeys: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (moduleKeys.length === 0) return result;

  let rows: Array<{ moduleKey: string; feeBps: number }> = [];
  try {
    rows = await prisma.workspaceModuleFee.findMany({
      where: { workspaceId, moduleKey: { in: moduleKeys } },
      select: { moduleKey: true, feeBps: true },
    });
  } catch {
    rows = [];
  }

  const configured = new Map(rows.map((r) => [r.moduleKey, r.feeBps]));
  for (const key of moduleKeys) {
    result.set(key, resolvePlatformFeeBps(configured.get(key)));
  }
  return result;
}
