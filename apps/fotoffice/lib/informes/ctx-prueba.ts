import type { CtxInformes } from "./acceso";

/** Contexto de prueba (sólo para las pruebas): dueño del workspace, o alguien con un nivel por módulo. */
export function ctxDePrueba(workspaceId = "w1", role: string | null = "WORKSPACE_OWNER", levels: Record<string, string> = {}): CtxInformes {
  return { workspaceId, userId: 1, userLabel: "Prueba", role, acceso: { role, levels: levels as never } };
}
