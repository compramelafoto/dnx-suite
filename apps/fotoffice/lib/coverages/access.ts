import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel, hasModuleAction } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { COVERAGES_COORDINATE_ACTION } from "@/lib/permissions/actions";
import { COVERAGES_MODULE_KEY } from "./constants";

/**
 * Control de acceso del módulo, siempre en el servidor.
 *
 * El nivel sale de `getModuleLevel`, que ya incluye si el módulo está habilitado para ESE
 * workspace y qué rol tiene la persona: un workspace sin el módulo da `NONE` y no filtra, por
 * la vía del mensaje, que el módulo existe. Esconder un botón es lo cosmético, nunca el control.
 *
 * Tres escalones:
 * - VIEW: mirar la bandeja, la ficha de un pedido y la de una cobertura.
 * - MANAGE: revisar — notas internas, pedir un dato, reenviar el enlace y pasar a evaluación.
 *   Trabajo de secretaría que no compromete nada. El STAFF de antes (sin roles) queda acá por la
 *   compatibilidad de `levels.ts`, igual que hoy.
 * - MANAGE + `coverages.coordinate`: aprobar, rechazar, cerrar, generar coberturas, armar el
 *   equipo, convocar, ajustes y colaboradores. Comprometen el tiempo de voluntarios y la palabra
 *   de la institución. Dueño y admin la tienen siempre; el STAFF de antes, nunca (igual que hoy).
 */

async function contextoBase() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const [level, tieneAccion] = await Promise.all([
    getModuleLevel(user.id, workspace.id, COVERAGES_MODULE_KEY),
    hasModuleAction(user.id, workspace.id, COVERAGES_MODULE_KEY, COVERAGES_COORDINATE_ACTION),
  ]);
  if (!hasLevel(level, "VIEW")) redirect("/dashboard");
  const canReview = hasLevel(level, "MANAGE");
  // La acción sólo vale con MANAGE: `resolveModuleAction` ya lo exige, esto lo repite por las dudas.
  const canCoordinate = canReview && tieneAccion;
  return { user, workspace, level, canReview, canCoordinate };
}

/** Ver: la bandeja y las fichas de pedidos y coberturas. */
export async function requireCoveragesViewer() {
  return contextoBase();
}

/** Revisar: anotar, pedir información, reenviar el enlace y pasar a evaluación. */
export async function requireCoveragesReviewer() {
  const ctx = await contextoBase();
  if (!ctx.canReview) redirect("/coberturas");
  return ctx;
}

/** Coordinar: aprobar, rechazar, cerrar, generar, asignar, convocar, ajustes y colaboradores. */
export async function requireCoveragesCoordinator() {
  const ctx = await contextoBase();
  if (!ctx.canCoordinate) redirect("/coberturas?forbidden=coordinar");
  return ctx;
}
