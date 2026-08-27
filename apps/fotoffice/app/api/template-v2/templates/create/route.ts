import { prisma } from "@repo/db";
import { resolveActiveWorkspace } from "@/lib/workspace";
import {
  jsonError,
  jsonOk,
  readJsonWithLimit,
  requireTemplateV2ApiUser,
} from "@/lib/template-v2/server";
import { createTemplateV2 } from "@/lib/template-v2/server";
import { getTemplatePreset } from "@/lib/template-v2/server";
import { instantiatePresetPayload } from "@/lib/template-v2/server";
import { TemplateV2DomainError } from "@/lib/template-v2/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/template-v2/templates/create
 * Body opcional: `{ presetId?: string, name?: string }`
 * Sin body → plantilla vacía (compat).
 */
export async function POST(req: Request) {
  try {
    const user = await requireTemplateV2ApiUser();
    let body: Record<string, unknown> = {};
    try {
      body = (await readJsonWithLimit(req)) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const presetId =
      typeof body.presetId === "string" && body.presetId.trim()
        ? body.presetId.trim()
        : null;

    if (presetId) {
      const preset = getTemplatePreset(presetId);
      if (!preset) {
        throw new TemplateV2DomainError(
          "TEMPLATE_NOT_FOUND",
          "Preset no encontrado",
          404
        );
      }
      const payload = instantiatePresetPayload(preset);
      const result = await createTemplateV2({
        user,
        name:
          typeof body.name === "string" && body.name.trim()
            ? body.name
            : preset.name,
        description: preset.description,
        payload,
        product: "fotoffice",
      });
      await atarAInstitucion(user.id, result.templateId);
      return jsonOk({ ...result, presetId: preset.presetId }, 201);
    }

    const result = await createTemplateV2({
      user,
      name: typeof body.name === "string" ? body.name : undefined,
      product: "fotoffice",
    });
    await atarAInstitucion(user.id, result.templateId);
    return jsonOk(result, 201);
  } catch (err) {
    return jsonError(err);
  }
}

/**
 * Ata la plantilla recién creada a la institución activa.
 *
 * El servicio compartido no conoce workspaces —en las otras apps la plantilla es de una
 * persona—, así que el vínculo se establece acá. Sin esto la plantilla quedaría solo a nombre
 * de quien la creó, y la institución la perdería el día que esa persona deja la comisión.
 */
async function atarAInstitucion(userId: number, templateId: string): Promise<void> {
  const workspace = await resolveActiveWorkspace(userId);
  if (!workspace) return;
  await prisma.templateV2.update({
    where: { id: templateId },
    data: { workspaceId: workspace.id },
  });
}
