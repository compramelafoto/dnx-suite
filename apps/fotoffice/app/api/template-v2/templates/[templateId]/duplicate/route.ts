import { prisma, Prisma } from "@repo/db";
import { resolveActiveWorkspace } from "@/lib/workspace";
import {
  jsonError,
  jsonOk,
  readJsonWithLimit,
  requireTemplateV2ApiUser,
} from "@/lib/template-v2/server";
import { duplicateTemplateV2 } from "@/lib/template-v2/server";
import { templateKeyOf } from "@/lib/template-v2/keyed-template";
import { FOTOLIBRO_TEMPLATE_KEY } from "@/lib/fotolibro/constantes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ templateId: string }> };

/** POST /api/template-v2/templates/[templateId]/duplicate */
export async function POST(req: Request, context: Ctx) {
  try {
    const user = await requireTemplateV2ApiUser();
    const { templateId } = await context.params;
    const body = (await readJsonWithLimit(req)) as Record<string, unknown>;
    const result = await duplicateTemplateV2({
      user,
      templateId,
      name: typeof body.name === "string" ? body.name : undefined,
    });
    await prepararCopia(user.id, templateId, result.templateId, result.versionId);
    return jsonOk(result, 201);
  } catch (err) {
    return jsonError(err);
  }
}

/**
 * Deja la copia lista para esta app, cosa que el servicio compartido no sabe hacer:
 *
 * - **La ata a la institución activa.** El servicio la crea a nombre de la persona; sin
 *   `workspaceId` no aparecería en el listado, que muestra las de la institución.
 * - **Le saca la marca** (`metaJson.templateKey`). La copia del carnet se llevaría la marca del
 *   carnet, y entre dos plantillas con la misma marca gana la editada más recientemente: la copia
 *   pasaría a ser el carnet de todos los socios sin que nadie lo decidiera. Los fotolibros la
 *   conservan: son muchos con la misma marca a propósito.
 */
async function prepararCopia(userId: number, originalId: string, templateId: string, versionId: string) {
  // La copia de un fotolibro personal de un socio sigue siendo personal: no se ata a ninguna
  // institución, ni siquiera si quien la copia también trabaja en una.
  const original = await prisma.templateV2.findUnique({
    where: { id: originalId },
    select: { workspaceId: true },
  });
  const workspace = original?.workspaceId === null ? null : await resolveActiveWorkspace(userId);
  if (workspace) {
    await prisma.templateV2.update({
      where: { id: templateId },
      data: { workspaceId: workspace.id },
    });
  }

  const version = await prisma.templateV2Version.findUnique({
    where: { id: versionId },
    select: { metaJson: true },
  });
  const marca = templateKeyOf(version?.metaJson);
  // Un fotolibro copiado sigue siendo un fotolibro: hay muchos con la misma marca, y sin ella
  // la copia desaparecería de la lista de fotolibros.
  if (!marca || marca === FOTOLIBRO_TEMPLATE_KEY) return;
  const resto = { ...(version!.metaJson as Record<string, unknown>) };
  delete resto.templateKey;
  await prisma.templateV2Version.update({
    where: { id: versionId },
    data: { metaJson: resto as Prisma.InputJsonValue },
  });
}
