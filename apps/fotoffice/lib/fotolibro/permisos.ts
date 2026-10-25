import "server-only";
import { prisma } from "@repo/db";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { canDesignTemplates } from "@/lib/template-v2/access";
import { templateKeyOf } from "@/lib/template-v2/keyed-template";
import { canDesignFotolibros } from "./acceso";
import { FOTOLIBRO_TEMPLATE_KEY } from "./constantes";
import { accesoFotolibrosSocio } from "./socio";

/**
 * ¿Puede esta persona cargar fotos en este fotolibro? Misma regla que el editor:
 * - fotolibro del estudio: es de la institución activa y la persona gestiona Ventas (o Socios);
 * - fotolibro personal de un socio (sin institución): es suyo y su institución tiene el módulo.
 */
export async function puedeEditarFotolibro(userId: number, templateId: string): Promise<boolean> {
  const t = await prisma.templateV2.findUnique({
    where: { id: templateId },
    select: { workspaceId: true, ownerUserId: true, currentVersionId: true, status: true },
  });
  if (!t || t.status === "ARCHIVED" || !t.currentVersionId) return false;
  const v = await prisma.templateV2Version.findUnique({ where: { id: t.currentVersionId }, select: { metaJson: true } });
  if (templateKeyOf(v?.metaJson) !== FOTOLIBRO_TEMPLATE_KEY) return false;

  if (t.workspaceId === null) {
    return t.ownerUserId === userId && (await accesoFotolibrosSocio(userId)) !== null;
  }
  const workspace = await resolveActiveWorkspace(userId);
  if (!workspace || workspace.id !== t.workspaceId) return false;
  return (await canDesignFotolibros(userId, workspace.id)) || (await canDesignTemplates(userId, workspace.id));
}
