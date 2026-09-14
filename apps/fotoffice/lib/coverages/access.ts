import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { COVERAGES_MODULE_KEY } from "./constants";
import { canCoordinateCoverages, canReviewCoverages } from "./access-policy";

/**
 * Control de acceso en dos niveles y siempre en el servidor.
 *
 * Nivel 1: el módulo está encendido para ESE workspace. Nivel 2: la persona tiene el rol.
 * Se comprueban en ese orden para que un workspace sin el módulo no filtre, por la vía del
 * mensaje de error, que el módulo existe.
 */
async function contextoBase() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  if (!(await isModuleEnabledForWorkspace(workspace.id, COVERAGES_MODULE_KEY))) {
    redirect("/dashboard?coberturas=off");
  }
  const role = await resolveWorkspaceRole(user.id, workspace.id);
  return { user, workspace, role };
}

/** Ver la bandeja, anotar, pedir información. */
export async function requireCoveragesReviewer() {
  const ctx = await contextoBase();
  if (!canReviewCoverages(ctx.role)) redirect("/dashboard");
  return ctx;
}

/** Aprobar, rechazar, configurar, asignar. */
export async function requireCoveragesCoordinator() {
  const ctx = await contextoBase();
  if (!canCoordinateCoverages(ctx.role)) redirect("/coberturas?forbidden=coordinar");
  return ctx;
}
