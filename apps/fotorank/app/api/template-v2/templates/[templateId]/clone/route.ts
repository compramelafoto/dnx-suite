import {
  jsonError,
  jsonOk,
  readJsonWithLimit,
  requireTemplateV2ApiUser,
} from "../../../../../lib/fotorank/design/server";
import { duplicateTemplateV2 } from "../../../../../lib/fotorank/design/server";
import { atarAOrganizacion } from "../../../../../lib/fotorank/design/ownership";

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
    await atarAOrganizacion(result.templateId, user.workspaceId);
    return jsonOk(result, 201);
  } catch (err) {
    return jsonError(err);
  }
}
