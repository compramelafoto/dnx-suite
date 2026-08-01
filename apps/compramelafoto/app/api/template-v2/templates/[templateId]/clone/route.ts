import {
  jsonError,
  jsonOk,
  readJsonWithLimit,
  requireTemplateV2ApiUser,
} from "@/lib/template-v2/services/template-v2-http";
import { duplicateTemplateV2 } from "@/lib/template-v2/services/template-v2-command-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ templateId: string }> };

/** POST /api/template-v2/templates/[templateId]/clone — alias editor. */
export async function POST(req: Request, context: Ctx) {
  try {
    const user = await requireTemplateV2ApiUser();
    const { templateId } = await context.params;
    let name: string | undefined;
    try {
      const body = (await readJsonWithLimit(req)) as Record<string, unknown>;
      name = typeof body.name === "string" ? body.name : undefined;
    } catch {
      name = undefined;
    }
    const result = await duplicateTemplateV2({ user, templateId, name });
    return jsonOk(result, 201);
  } catch (err) {
    return jsonError(err);
  }
}
