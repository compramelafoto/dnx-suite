import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { COMMUNICATIONS_MODULE_KEY } from "@/lib/communications/constants";

/**
 * Control de acceso de Comunicación → Placas, siempre en el servidor.
 *
 * - VIEW: ver las bienvenidas, descargar las placas, copiar el texto y marcarlas como publicadas.
 *   Es el trabajo de quien lleva las redes; no cambia nada de la institución.
 * - MANAGE: además, diseñar las plantillas y sumar a mano una bienvenida.
 *
 * Dueño y admin tienen MANAGE siempre (con el módulo encendido); el resto, según su rol.
 */
async function contexto() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const level = await getModuleLevel(user.id, workspace.id, COMMUNICATIONS_MODULE_KEY);
  return { user, workspace, level, canManage: hasLevel(level, "MANAGE") };
}

export async function requireCommunicationsViewer() {
  const ctx = await contexto();
  if (!hasLevel(ctx.level, "VIEW")) redirect("/dashboard");
  return ctx;
}

export async function requireCommunicationsManager() {
  const ctx = await contexto();
  if (!ctx.canManage) redirect("/comunicacion/placas");
  return ctx;
}
