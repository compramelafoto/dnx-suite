import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel, hasModuleAction } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { RAFFLES_CONDUCT_ACTION } from "@/lib/permissions/actions";
import { RAFFLES_MODULE_KEY } from "./constants";

/**
 * Control de acceso del módulo, siempre en el servidor.
 *
 * El nivel sale de `getModuleLevel`, que ya incluye si el módulo está habilitado para ESE
 * workspace y qué rol tiene la persona. Esconder el link del menú es lo cosmético, nunca el control.
 *
 * Tres escalones:
 * - VIEW: ver la lista, el detalle y las entregas pendientes, sin tocar nada.
 * - MANAGE: operar las entregas — avanzar un premio, registrar el recibo y reintentar avisos.
 *   El STAFF de antes (sin roles) queda acá por la compatibilidad de `levels.ts`.
 * - MANAGE + `raffles.conduct`: crear, editar, anunciar, sellar, resolver y cancelar. Son los
 *   actos que definen el resultado, y quien los hace queda con nombre y apellido en la historia
 *   del sorteo. Dueño y admin la tienen siempre; el STAFF de antes, nunca (igual que hoy).
 */

async function contextoBase() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const [level, tieneAccion] = await Promise.all([
    getModuleLevel(user.id, workspace.id, RAFFLES_MODULE_KEY),
    hasModuleAction(user.id, workspace.id, RAFFLES_MODULE_KEY, RAFFLES_CONDUCT_ACTION),
  ]);
  if (!hasLevel(level, "VIEW")) redirect("/dashboard");
  const canOperate = hasLevel(level, "MANAGE");
  // La acción sólo vale con MANAGE: `resolveModuleAction` ya lo exige, esto lo repite por las dudas.
  const canConduct = canOperate && tieneAccion;
  return { user, workspace, level, canOperate, canConduct };
}

/** Ver: lista, detalle y entregas. */
export async function requireRafflesViewer() {
  return contextoBase();
}

/** Operar entregas: avanzar un premio, registrar el recibo, reintentar avisos. */
export async function requireRafflesOperator() {
  const ctx = await contextoBase();
  if (!ctx.canOperate) redirect("/sorteos");
  return ctx;
}

/** Conducir: crear, editar, premios, anunciar, sellar, resolver, cancelar y buscar aliados. */
export async function requireRafflesConductor() {
  const ctx = await contextoBase();
  if (!ctx.canConduct) redirect("/sorteos");
  return ctx;
}
