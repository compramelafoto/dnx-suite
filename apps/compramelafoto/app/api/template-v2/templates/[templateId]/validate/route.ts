import {
  jsonError,
  jsonOk,
  readJsonWithLimit,
  requireTemplateV2ApiUser,
} from "@/lib/template-v2/services/template-v2-http";
import { getTemplateV2Detail } from "@/lib/template-v2/services/template-v2-query-service";
import { validateLegacyTemplatePayload } from "@/lib/template-v2/services/template-v2-validation-service";
import { coreToLegacyPayload } from "@/lib/template-v2/services/template-v2-mappers";
import type { LegacyTemplateV2Payload } from "@repo/template-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ templateId: string }> };

/**
 * POST /api/template-v2/templates/[templateId]/validate
 * Body opcional: draft payload. Si no hay body, valida la versión actual en DB.
 * No persiste.
 */
export async function POST(req: Request, context: Ctx) {
  try {
    const user = await requireTemplateV2ApiUser();
    const { templateId } = await context.params;
    const body = (await readJsonWithLimit(req)) as Record<string, unknown>;

    let payload: LegacyTemplateV2Payload;
    let name = "Template";

    if (body.canvas && Array.isArray(body.blocks)) {
      payload = {
        canvas: body.canvas as LegacyTemplateV2Payload["canvas"],
        blocks: body.blocks as LegacyTemplateV2Payload["blocks"],
        variableBindings: Array.isArray(body.variableBindings)
          ? (body.variableBindings as LegacyTemplateV2Payload["variableBindings"])
          : [],
        meta:
          body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
            ? (body.meta as Record<string, unknown>)
            : {},
      };
    } else {
      const detail = await getTemplateV2Detail(user, templateId, { includeLegacy: false });
      name = detail.meta.name;
      payload = coreToLegacyPayload(detail.template).payload;
    }

    const result = validateLegacyTemplatePayload(payload, { id: templateId, name });
    return jsonOk({
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings,
      normalizedTemplate: result.normalizedTemplate,
    });
  } catch (err) {
    return jsonError(err);
  }
}
