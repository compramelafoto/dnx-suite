import {
  jsonError,
  requireTemplateV2ApiUser,
} from "@/lib/template-v2/services/template-v2-http";
import { listTemplateVersions } from "@/lib/template-v2/services/template-v2-query-service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ templateId: string }> };

/** GET /api/template-v2/templates/[templateId]/versions */
export async function GET(_req: Request, context: Ctx) {
  try {
    const user = await requireTemplateV2ApiUser();
    const { templateId } = await context.params;
    const data = await listTemplateVersions(user, templateId);
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
