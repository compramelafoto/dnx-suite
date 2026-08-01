import {
  jsonError,
  jsonOk,
  readJsonWithLimit,
  requireTemplateV2ApiUser,
} from "@/lib/template-v2/services/template-v2-http";
import { saveTemplateV2Version } from "@/lib/template-v2/services/template-v2-command-service";
import { loadEditorVersion } from "@/lib/template-v2/services/template-v2-query-service";
import { TemplateV2DomainError } from "@/lib/template-v2/services/template-v2-errors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ templateId: string; versionId: string }> };

/** GET — carga editor (TemplateEditorShell). */
export async function GET(_req: Request, context: Ctx) {
  try {
    const user = await requireTemplateV2ApiUser();
    const { templateId, versionId } = await context.params;
    const data = await loadEditorVersion(user, templateId, versionId);
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}

/** PUT — guarda versión con concurrency por revision. */
export async function PUT(req: Request, context: Ctx) {
  try {
    const user = await requireTemplateV2ApiUser();
    const { templateId, versionId } = await context.params;
    const body = await readJsonWithLimit(req);
    const result = await saveTemplateV2Version({
      user,
      templateId,
      versionId,
      body,
    });
    return jsonOk(result);
  } catch (err) {
    if (err instanceof TemplateV2DomainError && err.code === "TEMPLATE_EDIT_CONFLICT") {
      return NextResponse.json(
        {
          ok: false,
          error: "revision_conflict",
          code: err.code,
          currentRevision:
            err.details && typeof err.details === "object"
              ? (err.details as { currentRevision?: number }).currentRevision
              : undefined,
        },
        { status: 409 }
      );
    }
    return jsonError(err);
  }
}
