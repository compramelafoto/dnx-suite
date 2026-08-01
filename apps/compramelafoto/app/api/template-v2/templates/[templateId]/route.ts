import {
  jsonError,
  jsonOk,
  readJsonWithLimit,
  requireTemplateV2ApiUser,
} from "@/lib/template-v2/services/template-v2-http";
import {
  deleteTemplateV2,
  patchTemplateV2,
} from "@/lib/template-v2/services/template-v2-command-service";
import { getTemplateV2Detail } from "@/lib/template-v2/services/template-v2-query-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ templateId: string }> };

/** GET /api/template-v2/templates/[templateId] — CORE (+ legacy por defecto). */
export async function GET(req: Request, context: Ctx) {
  try {
    const user = await requireTemplateV2ApiUser();
    const { templateId } = await context.params;
    const url = new URL(req.url);
    const includeLegacy = url.searchParams.get("legacy") !== "0";
    const detail = await getTemplateV2Detail(user, templateId, { includeLegacy });
    return jsonOk({
      template: detail.template,
      legacy: detail.legacy,
      compatibilityWarnings: detail.compatibilityWarnings,
      meta: detail.meta,
    });
  } catch (err) {
    return jsonError(err);
  }
}

/** PATCH /api/template-v2/templates/[templateId] */
export async function PATCH(req: Request, context: Ctx) {
  try {
    const user = await requireTemplateV2ApiUser();
    const { templateId } = await context.params;
    const body = (await readJsonWithLimit(req)) as Record<string, unknown>;
    const result = await patchTemplateV2({
      user,
      templateId,
      body: {
        name: typeof body.name === "string" ? body.name : undefined,
        description:
          body.description === null || typeof body.description === "string"
            ? (body.description as string | null)
            : undefined,
        status:
          body.status === "DRAFT" || body.status === "ACTIVE" || body.status === "ARCHIVED"
            ? body.status
            : undefined,
        document: body.document ?? body.payload,
        expectedUpdatedAt:
          typeof body.expectedUpdatedAt === "string" ? body.expectedUpdatedAt : undefined,
      },
    });
    return jsonOk(result);
  } catch (err) {
    return jsonError(err);
  }
}

/** DELETE /api/template-v2/templates/[templateId] */
export async function DELETE(_req: Request, context: Ctx) {
  try {
    const user = await requireTemplateV2ApiUser();
    const { templateId } = await context.params;
    const result = await deleteTemplateV2({ user, templateId });
    return jsonOk(result);
  } catch (err) {
    return jsonError(err);
  }
}
