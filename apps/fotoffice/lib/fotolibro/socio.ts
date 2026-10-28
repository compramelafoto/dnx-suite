import "server-only";
import { prisma } from "@repo/db";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { loadPortalContext, type PortalContext } from "@/lib/portal/access";
import { templateKeyOf } from "@/lib/template-v2/keyed-template";
import { FOTOLIBRO_TEMPLATE_KEY, FOTOLIBROS_SOCIO_MODULE_KEY, TOPE_FOTOLIBROS_SOCIO } from "./constantes";

/**
 * Los fotolibros del socio, en su portal.
 *
 * Son de la persona, no de la institución: la plantilla se guarda con `ownerUserId` del socio y
 * **sin** `workspaceId`. Así la comisión no los ve en ninguna lista, y la regla del editor (ver
 * `lib/template-v2/server.ts`) sólo deja abrir una plantilla sin institución a quien la creó.
 *
 * La institución sólo decide si la sección aparece (el módulo `fotolibros-socios`).
 */

/** El portal del socio, si puede diseñar fotolibros: socio activo de una institución que lo encendió. */
export async function accesoFotolibrosSocio(userId: number): Promise<PortalContext | null> {
  const context = await loadPortalContext(userId);
  if (!context) return null;
  if (!(await isModuleEnabledForWorkspace(context.workspace.id, FOTOLIBROS_SOCIO_MODULE_KEY))) return null;
  return context;
}

export type FotolibroSocio = {
  id: string;
  name: string;
  description: string | null;
  currentVersionId: string | null;
  updatedAt: Date;
};

/** Los fotolibros personales de una persona: suyos, sin institución y con la marca de fotolibro. */
export async function listarFotolibrosSocio(userId: number): Promise<FotolibroSocio[]> {
  const plantillas = await prisma.templateV2.findMany({
    where: { ownerUserId: userId, workspaceId: null, status: { not: "ARCHIVED" }, currentVersionId: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: { id: true, name: true, description: true, currentVersionId: true, updatedAt: true },
  });
  if (plantillas.length === 0) return [];
  const versiones = await prisma.templateV2Version.findMany({
    where: { id: { in: plantillas.map((p) => p.currentVersionId as string) } },
    select: { id: true, metaJson: true },
  });
  const esFotolibro = new Set(
    versiones.filter((v) => templateKeyOf(v.metaJson) === FOTOLIBRO_TEMPLATE_KEY).map((v) => v.id),
  );
  return plantillas.filter((p) => esFotolibro.has(p.currentVersionId as string));
}

/** ¿Llegó al tope de fotolibros personales? Ver `TOPE_FOTOLIBROS_SOCIO`. */
export async function llegoAlTopeDeFotolibros(userId: number): Promise<boolean> {
  return (await listarFotolibrosSocio(userId)).length >= TOPE_FOTOLIBROS_SOCIO;
}

/** ¿Es un fotolibro personal de esta persona? Lo que decide si el editor del portal lo abre. */
export async function esFotolibroDelSocio(userId: number, templateId: string): Promise<boolean> {
  const p = await prisma.templateV2.findFirst({
    where: { id: templateId, ownerUserId: userId, workspaceId: null, status: { not: "ARCHIVED" } },
    select: { currentVersionId: true },
  });
  if (!p?.currentVersionId) return false;
  const v = await prisma.templateV2Version.findUnique({
    where: { id: p.currentVersionId },
    select: { metaJson: true },
  });
  return templateKeyOf(v?.metaJson) === FOTOLIBRO_TEMPLATE_KEY;
}
