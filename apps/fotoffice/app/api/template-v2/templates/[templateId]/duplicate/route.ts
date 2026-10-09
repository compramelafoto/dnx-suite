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
    await prepararCopia(user.id, result.templateId, result.versionId);
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
 *   pasaría a ser el carnet de todos los socios sin que nadie lo decidiera.
 */
async function prepararCopia(userId: number, templateId: string, versionId: string) {
  const workspace = await resolveActiveWorkspace(userId);
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
  if (!templateKeyOf(version?.metaJson)) return;
  const resto = { ...(version!.metaJson as Record<string, unknown>) };
  delete resto.templateKey;
  await prisma.templateV2Version.update({
    where: { id: versionId },
    data: { metaJson: resto as Prisma.InputJsonValue },
  });
}
