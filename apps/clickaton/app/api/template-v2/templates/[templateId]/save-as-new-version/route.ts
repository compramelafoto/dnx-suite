import {
  jsonError,
  jsonOk,
  readJsonWithLimit,
  requireTemplateV2ApiUser,
} from "@/lib/template-v2/server";
import { saveAsNewVersion } from "@/lib/template-v2/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ templateId: string }> };

export async function POST(req: Request, context: Ctx) {
  try {
    const user = await requireTemplateV2ApiUser();
    const { templateId } = await context.params;
    const body = await readJsonWithLimit(req);
    const result = await saveAsNewVersion({ user, templateId, body });
    return jsonOk(result, 201);
  } catch (err) {
    return jsonError(err);
  }
}
