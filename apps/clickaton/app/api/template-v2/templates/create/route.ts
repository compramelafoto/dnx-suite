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
        product: "clickaton",
      });
      return jsonOk({ ...result, presetId: preset.presetId }, 201);
    }

    const result = await createTemplateV2({
      user,
      name: typeof body.name === "string" ? body.name : undefined,
      product: "clickaton",
    });
    return jsonOk(result, 201);
  } catch (err) {
    return jsonError(err);
  }
}
