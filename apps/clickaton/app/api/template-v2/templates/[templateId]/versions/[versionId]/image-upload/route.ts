import {
  jsonError,
  jsonOk,
  requireTemplateV2ApiUser,
} from "@/lib/template-v2/server";
import { uploadTemplateVersionImage } from "@/lib/template-v2/server";
import { TemplateV2DomainError } from "@/lib/template-v2/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ templateId: string; versionId: string }> };

/** POST multipart FormData { file } */
export async function POST(req: Request, context: Ctx) {
  try {
    const user = await requireTemplateV2ApiUser();
    const { templateId, versionId } = await context.params;
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new TemplateV2DomainError("TEMPLATE_ASSET_INVALID", "Falta el archivo (file)", 422);
    }
    const result = await uploadTemplateVersionImage({
      user,
      templateId,
      versionId,
      file,
    });
    return jsonOk(result);
  } catch (err) {
    return jsonError(err);
  }
}
