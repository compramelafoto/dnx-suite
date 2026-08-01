import {
  jsonError,
  jsonOk,
  requireTemplateV2ApiUser,
} from "@/lib/template-v2/services/template-v2-http";
import { submitTemplateForReview } from "@/lib/template-v2/services/template-v2-command-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ templateId: string }> };

export async function POST(_req: Request, context: Ctx) {
  try {
    const user = await requireTemplateV2ApiUser();
    const { templateId } = await context.params;
    const result = await submitTemplateForReview({ user, templateId });
    return jsonOk(result);
  } catch (err) {
    return jsonError(err);
  }
}
